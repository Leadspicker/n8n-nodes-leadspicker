import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import type {
	INodePropertyOptions,
	NodeConnectionType,
	NodeParameterValueType,
} from 'n8n-workflow';

import * as moment from 'moment-timezone';
import { leadspickerApiRequest, getUserTimezone } from './GenericFunctions';

// Interfaces remain the same...
interface IEmailAccountItem {
	address: string;
}
interface IEmailAccountsFilter {
	email: IEmailAccountItem[];
}
interface IProjectItem {
	id: number | string;
	idManual?: number;
}
interface IProjectsFilter {
	project: IProjectItem[];
}
interface ISentimentItem {
	type: string;
}
interface ISentimentFilter {
	sentiment_value: ISentimentItem[];
}

const MANUAL_ID_OPTION = '__manual__';

export class LeadspickerNode implements INodeType {
	private static toNumericId(value: unknown): number | undefined {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === 'string' && value.trim() !== '') {
			const parsed = Number(value);
			return Number.isNaN(parsed) ? undefined : parsed;
		}
		return undefined;
	}

	private static getIdOrThrow(
		context: IExecuteFunctions,
		value: unknown,
		fieldName: string,
	): number {
		const id = LeadspickerNode.toNumericId(value);
		if (id === undefined) {
			throw new NodeOperationError(context.getNode(), `Please select a valid ${fieldName}.`);
		}
		return id;
	}

	private static getIdFromOptionOrManual(
		context: IExecuteFunctions,
		optionName: string,
		manualName: string,
		fieldName: string,
		i: number,
	): number {
		const selection = context.getNodeParameter(optionName, i) as NodeParameterValueType;
		if (selection === undefined || selection === null || selection === '') {
			throw new NodeOperationError(context.getNode(), `Please select a ${fieldName}.`);
		}
		if (selection === MANUAL_ID_OPTION) {
			const manualValue = context.getNodeParameter(manualName, i);
			return LeadspickerNode.getIdOrThrow(context, manualValue, fieldName);
		}
		return LeadspickerNode.getIdOrThrow(context, selection, fieldName);
	}

	private static tryGetIdFromParameters(params: IDataObject, optionName: string, manualName: string): number | undefined {
		const selection = params[optionName];
		if (selection === undefined || selection === null || selection === '') {
			return undefined;
		}
		if (selection === MANUAL_ID_OPTION) {
			return LeadspickerNode.toNumericId(params[manualName]);
		}
		return LeadspickerNode.toNumericId(selection);
	}

	private static getProjectIdForPersonOptions(context: ILoadOptionsFunctions): number | undefined {
		const params = (context.getCurrentNodeParameters?.() ?? {}) as IDataObject;
		return (
			LeadspickerNode.tryGetIdFromParameters(params, 'personLookupProjectId', 'personLookupProjectIdManual') ??
			LeadspickerNode.tryGetIdFromParameters(params, 'projectId', 'projectIdManual')
		);
	}

	methods = {
		loadOptions: {
			async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const query: IDataObject = { limit: 50 };
				const response = await leadspickerApiRequest.call(this, 'GET', '/projects', {}, query);
				const list = Array.isArray(response)
					? (response as IDataObject[])
					: (Array.isArray((response as IDataObject)?.results)
							? ((response as IDataObject).results as IDataObject[])
							: []);
				const options: INodePropertyOptions[] = [];
				for (const project of list) {
					const id = LeadspickerNode.toNumericId(project?.id as NodeParameterValueType);
					if (id === undefined) continue;
					const name = typeof project?.name === 'string' && project.name.trim() !== ''
						? project.name.trim()
						: `Project #${id}`;
					options.push({ name, value: id.toString() });
				}
				return options;
			},
			async getPersons(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const projectId = LeadspickerNode.getProjectIdForPersonOptions(this);
				if (projectId === undefined) {
					return [];
				}
				const query: IDataObject = { project_id: projectId, page_size: 50 };
				const response = await leadspickerApiRequest.call(
					this,
					'GET',
					'/persons-simple',
					{},
					query,
				);
				const responseObject = response as IDataObject;
				const list = Array.isArray(responseObject?.items)
					? (responseObject.items as IDataObject[])
					: Array.isArray(responseObject?.results)
						? (responseObject.results as IDataObject[])
						: Array.isArray(response)
							? (response as IDataObject[])
							: [];
				const options: INodePropertyOptions[] = [];
				for (const person of list) {
					const id = LeadspickerNode.toNumericId(person?.id as NodeParameterValueType);
					if (id === undefined) continue;
					const personData = (person?.person_data ?? {}) as IDataObject;
					const firstName = [personData.first_name, person?.first_name]
						.find((name) => typeof name === 'string' && name.trim() !== '') as string | undefined;
					const lastName = [personData.last_name, person?.last_name]
						.find((name) => typeof name === 'string' && name.trim() !== '') as string | undefined;
					const fullName =
						typeof personData.full_name === 'string' && personData.full_name.trim() !== ''
							? personData.full_name.trim()
							: [firstName, lastName]
								.filter((val) => typeof val === 'string')
								.map((val) => (val as string).trim())
								.filter((val) => val !== '')
								.join(' ');
					const emailCandidate = [personData.email, person?.email]
						.find((addr) => typeof addr === 'string' && addr.trim() !== '') as string | undefined;
					const name = fullName || emailCandidate || `Person #${id}`;
					options.push({ name, value: id.toString() });
				}
				return options;
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Leadspicker Node',
		name: 'leadspickerNode',
		icon: 'file:logo_leadspicker.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Interact with Leadspicker API',
		defaults: {
			name: 'Leadspicker Node',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 'leadspickerApi',
				required: true,
			},
		],
		properties: [
			// Resource Property
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'AutoCPH',
						value: 'autocph',
					},
					{
						name: 'Linkedin',
						value: 'linkedinActivity',
					},
					{
						name: 'Person',
						value: 'person',
					},
					{
						name: 'Project',
						value: 'project',
					},
					{
						name: 'Reply',
						value: 'reply',
					},
				],
				default: 'project',
			},

			// Person Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['person'],
					},
				},
				options: [
					{
						name: 'Create Person',
						value: 'create',
						description: 'Create a new person in a project',
						action: 'Create a person',
					},
					{
						name: 'Delete Person',
						value: 'delete',
						description: 'Delete a person',
						action: 'Delete a person',
					},
					{
						name: 'Get Person',
						value: 'get',
						description: 'Get a person by ID',
						action: 'Get a person',
					},
					{
						name: 'List Persons',
						value: 'list',
						description: 'List persons in a project',
						action: 'List persons',
					},
					{
						name: 'Update Person',
						value: 'update',
						description: 'Update an existing person',
						action: 'Update a person',
					},
				],
				default: 'create',
			},

			// Project Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['project'],
					},
				},
				options: [
					{
						name: 'Create Project',
						value: 'create',
						description: 'Create a new project',
						action: 'Create a project',
					},
					{
						name: 'Delete Project',
						value: 'delete',
						description: 'Delete a project',
						action: 'Delete a project',
					},
				],
				default: 'create',
			},

			// Reply operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['reply'],
					},
				},
				options: [
					{
						name: 'Get Replies',
						value: 'list',
						description: 'Get replies for a person',
						action: 'Get replies',
					},
				],
				default: 'list',
			},

			// AutoCPH operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['autocph'],
					},
				},
				options: [
					{
						name: 'By Company Linkedin',
						value: 'byCompanyLinkedin',
						description: 'Automatically get person by company linkedin',
						action: 'Get person by company linkedin',
					},
					{
						name: 'By Company Name',
						value: 'byCompanyName',
						description: 'Automatically get person by company name',
						action: 'Get person by company name',
					},
				],
				default: 'byCompanyLinkedin',
			},

			// Linkedin Activity operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
					},
				},
				options: [
					{
						name: 'Get Activities',
						value: 'getActivities',
						description: "Get a profile's recent activities (reactions and comments)",
						action: 'Get recent activities',
					},
					{
						name: 'Get Post Reactors',
						value: 'getPostReactors',
						description: 'Get people who reacted to posts and send to a webhook',
						action: 'Get post reactors',
					},
					{
						name: 'Get Posts',
						value: 'getPosts',
						description: "Get a profile's latest posts",
						action: 'Get latest posts',
					},
					{
						name: 'Get Profile',
						value: 'getProfile',
						description: 'Scrapes and returns details for a LinkedIn profile',
						action: 'Get profile details',
					},
					{
						name: 'Profiles Post Reactors',
						value: 'profilesPostReactors',
						description:
							'Retrieve reactors for posts authored by specific LinkedIn profiles',
						action: 'Get reactors for profiles',
					},
					{
						name: 'Search Post Reactors',
						value: 'searchPostReactors',
						description:
							'Retrieve LinkedIn profiles that reacted to posts returned by a content search URL',
						action: 'Search post reactors',
					},
				],
				default: 'getProfile',
			},

			// Project Name field for create operation
			{
				displayName: 'Project Name',
				name: 'projectName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['create'],
					},
				},
				default: '',
				description: 'Name of the project to create',
			},

			{
				displayName: 'Project Timezone',
				name: 'projectTimezone',
				type: 'options',
				// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
				default: getUserTimezone(),
				required: true,
				placeholder: 'Set Timezone',
				options: moment.tz.names().map((timezone) => ({
					name: timezone,
					value: timezone,
				})),
				description: 'Timezone of the project',
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['create'],
					},
				},
			},

			// Project selector for delete operation
			{
				displayName: 'Project Name or ID',
				name: 'projectDeleteId',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['delete'],
					},
				},
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getProjects',
				},
				options: [
					{ name: 'Select a project...', value: '' },
					{ name: 'Enter Project ID manually...', value: MANUAL_ID_OPTION },
				],
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Project ID',
				name: 'projectDeleteIdManual',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['delete'],
						projectDeleteId: [MANUAL_ID_OPTION],
					},
				},
				default: 0,
				description: 'ID of the project to delete',
			},

			// Create Person fields
			{
				displayName: 'Project Name or ID',
				name: 'projectId',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'list'],
					},
				},
				default: '',
				options: [
					{ name: 'Select a project...', value: '' },
					{ name: 'Enter Project ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getProjects',
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Project ID',
				name: 'projectIdManual',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'list'],
						projectId: [MANUAL_ID_OPTION],
					},
				},
				default: 0,
				description: 'ID of the project that contains the person records',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['list'],
					},
				},
				description: 'Page number for pagination',
			},
			{
				displayName: 'Results Per Page',
				name: 'pageSize',
				type: 'number',
				default: 100,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['list'],
					},
				},
				description: 'Number of results to return per page',
			},

			// Person lookup project for option list
			{
				displayName: 'Person Lookup Project Name or ID',
				name: 'personLookupProjectId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['get', 'update', 'delete'],
					},
				},
				// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
				default: '',
				options: [
					{ name: 'Select a project...', value: '' },
					{ name: 'Enter Project ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getProjects',
				},
					description:
						'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Person Lookup Project ID',
				name: 'personLookupProjectIdManual',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['get', 'update', 'delete'],
						personLookupProjectId: [MANUAL_ID_OPTION],
					},
				},
				default: 0,
				description: 'Project ID to load people from when entering manually',
			},

			// Person ID field for get, update, delete operations
			{
				displayName: 'Person Name or ID',
				name: 'personId',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['get', 'update', 'delete'],
					},
				},
				default: '',
				options: [
					{ name: 'Select a person...', value: '' },
					{ name: 'Enter Person ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getPersons',
					loadOptionsDependsOn: [
						'personLookupProjectId',
						'personLookupProjectIdManual',
						'projectId',
						'projectIdManual',
					],
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Person ID',
				name: 'personIdManual',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['get', 'update', 'delete'],
						personId: [MANUAL_ID_OPTION],
					},
				},
				default: 0,
				description: 'ID of the person',
			},

			// Person Details Section
			{
				displayName: 'Person Details',
				name: 'personDetails',
				type: 'collection',
				placeholder: 'Add Person Detail',
				default: {},
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						displayName: 'Country',
						name: 'country',
						type: 'string',
						default: '',
						description: 'Country of the person',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						description: 'Email address of the person',
					},
					{
						displayName: 'First Name',
						name: 'first_name',
						type: 'string',
						default: '',
						description: 'First name of the person',
					},
					{
						displayName: 'Last Name',
						name: 'last_name',
						type: 'string',
						default: '',
						description: 'Last name of the person',
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'string',
						default: '',
						description: 'Job position/title of the person',
					},
				],
			},

			// Company Details Section
			{
				displayName: 'Company Details',
				name: 'companyDetails',
				type: 'collection',
				placeholder: 'Add Company Detail',
				default: {},
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						displayName: 'Company Name',
						name: 'company_name',
						type: 'string',
						default: '',
						description: 'Company name where the person works',
					},
					{
						displayName: 'Company Website',
						name: 'company_website',
						type: 'string',
						default: '',
						description: 'Company website URL',
					},
					{
						displayName: 'Company LinkedIn',
						name: 'company_linkedin',
						type: 'string',
						default: '',
						description: 'Company LinkedIn URL',
					},
				],
			},

			// Social Profiles Section
			{
				displayName: 'Social Profiles',
				name: 'socialProfiles',
				type: 'collection',
				placeholder: 'Add Social Profile',
				default: {},
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						displayName: 'LinkedIn',
						name: 'linkedin',
						type: 'string',
						default: '',
						description: 'Personal LinkedIn URL',
					},
					{
						displayName: 'Sales Navigator',
						name: 'salesnav',
						type: 'string',
						default: '',
						description: 'LinkedIn Sales Navigator URL',
					},
				],
			},

			// Custom Fields Section
			{
				displayName: 'Custom Fields',
				name: 'customFields',
				type: 'fixedCollection',
				placeholder: 'Add Custom Field',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						displayName: 'Field',
						name: 'field',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								description: 'Custom field key',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Custom field value',
							},
						],
					},
				],
			},

			// Reply Filters
			{
				displayName: 'Filters',
				name: 'replyFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['reply'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'Email Accounts',
						name: 'email_accounts',
						type: 'fixedCollection',
						placeholder: 'Add Email Account',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Email accounts to filter by',
						options: [
							{
								displayName: 'Email',
								name: 'email',
								values: [
									{
										displayName: 'Email Address',
										name: 'address',
										type: 'string',
										default: '',
										placeholder: 'john@doe.com',
										description: 'Email address to filter by',
									},
								],
							},
						],
					},
					{
						displayName: 'Projects',
						name: 'projects',
						type: 'fixedCollection',
						placeholder: 'Add Project',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Project IDs to filter by',
						options: [
							{
								displayName: 'Project',
								name: 'project',
								values: [
									{
										displayName: 'Project Name or ID',
										name: 'id',
										type: 'options',
										default: '',
										options: [
											{ name: 'Select a project...', value: '' },
											{ name: 'Enter Project ID manually...', value: MANUAL_ID_OPTION },
										],
										typeOptions: {
											loadOptionsMethod: 'getProjects',
										},
										description:
											'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
									},
									{
										displayName: 'Project ID',
										name: 'idManual',
										type: 'number',
										required: true,
										displayOptions: {
											show: {
												id: [MANUAL_ID_OPTION],
											},
										},
											default: 0,
											description: 'Project ID to filter by',
										},
								],
							},
						],
					},
					{
						displayName: 'Sentiment',
						name: 'sentiment',
						type: 'fixedCollection',
						placeholder: 'Add Sentiment',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Sentiment values to filter by',
						options: [
							{
								displayName: 'Sentiment',
								name: 'sentiment_value',
								values: [
									{
										displayName: 'Sentiment Type',
										name: 'type',
										type: 'options',
										default: 'positive',
										options: [
											{
												name: 'Interested',
												value: 'interested',
											},
											{
												name: 'Negative',
												value: 'negative',
											},
											{
												name: 'Neutral',
												value: 'neutral',
											},
											{
												name: 'Not Interested',
												value: 'not_interested',
											},
											{
												name: 'Positive',
												value: 'positive',
											},
										],
										description: 'Sentiment type to filter by',
									},
								],
							},
						],
					},
				],
			},

			{
				displayName: 'Company Name',
				name: 'companyName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyName'],
					},
				},
				default: '',
				description: 'The name of the company to search for contacts in',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyName'],
					},
				},
				default: '',
				description: 'The country where the headquarters of the company is located (optional)',
			},
			{
				displayName: 'Company Linkedin URL or Handle',
				name: 'companyLinkedin',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyLinkedin'],
					},
				},
				default: '',
				description: 'The LinkedIn URL or handle of the company',
			},
			{
				displayName: 'LinkedIn Profile URL',
				name: 'linkedinUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getPosts', 'getActivities', 'getProfile'],
					},
				},
				default: '',
				description: 'The LinkedIn URL of the personal or company profile',
			},
			{
				displayName: 'Search URL',
				name: 'searchUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['searchPostReactors'],
					},
				},
				default: '',
				description: 'The LinkedIn content search URL to iterate posts from',
			},
			{
				displayName: 'Profile URLs',
				name: 'profilesList',
				type: 'fixedCollection',
				placeholder: 'Add Profile URL',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['profilesPostReactors'],
					},
				},
				description: 'A list of LinkedIn profile URLs to get reactors from',
				options: [
					{
						name: 'profiles',
						displayName: 'Profile',
						values: [
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								description: 'A LinkedIn profile URL',
							},
						],
					},
				],
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getPostReactors'],
					},
				},
				default: '',
				description: 'The URL to send the webhook payload to when data is ready',
			},
			{
				displayName: 'Profile URLs',
				name: 'profileUrls',
				type: 'fixedCollection',
				placeholder: 'Add Profile URL',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getPostReactors'],
					},
				},
				description: 'A list of LinkedIn profile URLs to get post reactors from',
				options: [
					{
						name: 'urls',
						displayName: 'URL',
						values: [
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								description: 'A LinkedIn profile URL',
							},
						],
					},
				],
			},
			{
				displayName: 'Post Reactors Options',
				name: 'postReactorsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getPostReactors'],
					},
				},
				options: [
					{
						displayName: 'Max Post Age (Days)',
						name: 'maxPostsAge',
						type: 'number',
						default: 90,
						description: 'The maximum age of posts to consider, in days',
					},
					{
						displayName: 'Max Posts per Profile',
						name: 'maxPostsPerLink',
						type: 'number',
						default: 30,
						description: 'The maximum number of posts to check per profile URL',
					},
					{
						displayName: 'Max Reactors per Post',
						name: 'maxReactors',
						type: 'number',
						default: 50,
						description: 'The maximum number of reactors to return per post',
					},
				],
			},
			{
				displayName: 'Reactors Search Options',
				name: 'reactorsSearchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['searchPostReactors', 'profilesPostReactors'],
					},
				},
				options: [
					{
						displayName: 'Deduplicate',
						name: 'deduplicate',
						type: 'boolean',
						default: false,
						description: 'Whether to deduplicate reactors across posts',
					},
					{
						displayName: 'Include Author',
						name: 'includeAuthor',
						type: 'boolean',
						default: false,
						description: 'Whether to include the post author in the results',
					},
					{
						displayName: 'Max Age Days',
						name: 'maxAgeDays',
						type: 'number',
						default: 90,
						description: 'Only consider posts up to this age in days',
					},
					{
						displayName: 'Max Commenters Per Post',
						name: 'commentersPerPost',
						type: 'number',
						default: 0,
						description: 'Maximum number of commenters to return per post',
					},
					{
						displayName: 'Max Likers Per Post',
						name: 'likersPerPost',
						type: 'number',
						default: 0,
						description: 'Maximum number of likers to return per post',
					},
					{
						displayName: 'Posts Limit',
						name: 'postsLimit',
						type: 'number',
						default: 30,
						description: 'Maximum number of posts to iterate per request',
					},
				],
			},
			{
				displayName: 'Functions',
				name: 'functions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Function',
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyLinkedin', 'byCompanyName'],
					},
				},
				default: {},
				description: 'Job functions to filter by (e.g., CEO, Founder, Head of Sales)',
				options: [
					{
						name: 'functionValues',
						displayName: 'Function',
						values: [
							{
								displayName: 'Function',
								name: 'function',
								type: 'string',
								default: '',
								description: 'A job function, e.g., "CEO" or "Head of Sales"',
							},
						],
					},
				],
			},
			{
				displayName: 'Search Result Limit',
				name: 'searchResultLimit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyLinkedin', 'byCompanyName'],
					},
				},
				default: 2,
				description: 'The maximum number of persons to return',
			},
			{
				displayName: 'Enrich with Emails',
				name: 'enrichEmails',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyLinkedin', 'byCompanyName'],
					},
				},
				default: false,
				description: 'Whether to try and find and include email addresses for the contacts',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['autocph'],
						operation: ['byCompanyLinkedin'],
					},
				},
				options: [
					{
						displayName: 'Live Check Current Position',
						name: 'liveCheckCurrentPosition',
						type: 'boolean',
						default: true,
						description:
							'Whether to perform a live check to verify if the person currently works at the company (as data could be stale)',
					},
					{
						displayName: 'Use Embeddings Similarity',
						name: 'useEmbeddingsSimilarity',
						type: 'boolean',
						default: true,
						description:
							"Whether to use embeddings similarity to compare provided functions with the persons' positions. Defaults to true.",
					},
					{
						displayName: 'Embeddings Distance Threshold',
						name: 'embeddingsDistanceThreshold',
						type: 'number',
						typeOptions: {
							numberStep: 0.01,
						},
						default: 0.53,
						description:
							'The threshold for embeddings similarity. A lower value means a closer match. Default is 0.53.',
					},
				],
			},
		],
	};

	/**
	 * Handles operations for the 'Person' resource.
	 */
	private static async handlePersonOperations(context: IExecuteFunctions, i: number): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'list': {
				const projectId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'projectId',
					'projectIdManual',
					'project',
					i,
				);
				const page = context.getNodeParameter('page', i, 1) as number;
				const pageSize = context.getNodeParameter('pageSize', i) as number;
				const qs: IDataObject = { project_id: projectId, page_size: pageSize, page: page };
				return leadspickerApiRequest.call(context, 'GET', `/persons-simple`, {}, qs);
			}
			case 'create':
			case 'update': {
				const personDetails = context.getNodeParameter('personDetails', i) as IDataObject;
				const companyDetails = context.getNodeParameter('companyDetails', i) as IDataObject;
				const socialProfiles = context.getNodeParameter('socialProfiles', i) as IDataObject;
				const customFields = context.getNodeParameter('customFields', i) as IDataObject;
				const body: IDataObject = {
					data_source: 'user_provided',
					...personDetails,
					...companyDetails,
					...socialProfiles,
				};

				if (customFields.field && Array.isArray(customFields.field)) {
					const customFieldsObj: IDataObject = {};
					for (const field of customFields.field as any[]) {
						if (field.key && field.value) customFieldsObj[field.key] = field.value;
					}
					if (Object.keys(customFieldsObj).length > 0) body.custom_fields = customFieldsObj;
				}

				Object.keys(body).forEach((key) => {
					if (body[key] === '' || body[key] === null || body[key] === undefined) delete body[key];
				});

				if (operation === 'create') {
					body.project_id = LeadspickerNode.getIdFromOptionOrManual(
						context,
						'projectId',
						'projectIdManual',
						'project',
						i,
					);
					return leadspickerApiRequest.call(context, 'POST', '/persons', body);
				} else {
					const personId = LeadspickerNode.getIdFromOptionOrManual(
						context,
						'personId',
						'personIdManual',
						'person',
						i,
					);
					return leadspickerApiRequest.call(context, 'PATCH', `/persons/${personId}`, body);
				}
			}
			case 'get': {
				const personId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'personId',
					'personIdManual',
					'person',
					i,
				);
				return leadspickerApiRequest.call(context, 'GET', `/persons-simple/${personId}`);
			}
			case 'delete': {
				const personId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'personId',
					'personIdManual',
					'person',
					i,
				);
				return leadspickerApiRequest.call(context, 'DELETE', `/persons/${personId}`);
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Person resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Project' resource.
	 */
	private static async handleProjectOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'create': {
				const projectName = context.getNodeParameter('projectName', i) as string;
				const projectTimezone = context.getNodeParameter('projectTimezone', i) as string;
				const body: IDataObject = { name: projectName, timezone: projectTimezone };
				return leadspickerApiRequest.call(context, 'POST', '/projects', body);
			}
			case 'delete': {
				const projectId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'projectDeleteId',
					'projectDeleteIdManual',
					'project',
					i,
				);
				return leadspickerApiRequest.call(context, 'DELETE', `/projects/${projectId}`);
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Project resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Reply' resource.
	 */
	private static async handleReplyOperations(context: IExecuteFunctions, i: number): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		if (operation === 'list') {
			const filters = context.getNodeParameter('replyFilters', i) as IDataObject;
			const rawQueryParts: string[] = [];

			const emailAccountsFilter = filters.email_accounts as IEmailAccountsFilter;
			if (emailAccountsFilter?.email?.length) {
				const emailAccounts = emailAccountsFilter.email
					.map((item) => item.address)
					.filter((address) => address && address.trim() !== '');
				emailAccounts.forEach((email) =>
					rawQueryParts.push(`email_accounts=${encodeURIComponent(email)}`),
				);
			}

			const projectsFilter = filters.projects as IProjectsFilter;
			if (projectsFilter?.project?.length) {
				projectsFilter.project
					.map((item) => {
						if (item.id === MANUAL_ID_OPTION) {
							return LeadspickerNode.toNumericId(item.idManual);
						}
						return LeadspickerNode.toNumericId(item.id);
					})
					.filter((id): id is number => id !== undefined)
					.forEach((id) => rawQueryParts.push(`projects=${encodeURIComponent(id)}`));
			}

			const sentimentFilter = filters.sentiment as ISentimentFilter;
			if (sentimentFilter?.sentiment_value?.length) {
				const sentimentValues = sentimentFilter.sentiment_value
					.map((item) => item.type)
					.filter((type) => type && type.trim() !== '');
				sentimentValues.forEach((val) =>
					rawQueryParts.push(`sentiment=${encodeURIComponent(val)}`),
				);
			}

			let path = '/inbound-messages';
			if (rawQueryParts.length > 0) path += '?' + rawQueryParts.join('&');

			return leadspickerApiRequest.call(context, 'GET', path, {}, {});
		}

		throw new NodeOperationError(
			context.getNode(),
			`The operation "${operation}" is not supported for Reply resource.`,
		);
	}

	/**
	 * Handles operations for the 'AutoCPH' resource.
	 */
	private static async handleAutoCphOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'byCompanyLinkedin': {
				const companyLinkedin = context.getNodeParameter('companyLinkedin', i) as string;
				const functionsCollection = context.getNodeParameter('functions', i, {}) as {
					functionValues?: { function: string }[];
				};
				const searchResultLimit = context.getNodeParameter('searchResultLimit', i, 2) as number;
				const enrichEmails = context.getNodeParameter('enrichEmails', i, false) as boolean;
				const additionalOptions = context.getNodeParameter(
					'additionalOptions',
					i,
					{},
				) as IDataObject;

				const body: IDataObject = {
					company_linkedin: companyLinkedin,
					enrich_emails: enrichEmails,
					search_result_limit: searchResultLimit,
					live_check_current_position: additionalOptions.liveCheckCurrentPosition ?? true,
					use_embeddings_similarity: additionalOptions.useEmbeddingsSimilarity ?? true,
					embeddings_distance_threshold: additionalOptions.embeddingsDistanceThreshold ?? 0.53,
				};

				if (functionsCollection.functionValues?.length) {
					const functions = functionsCollection.functionValues
						.map((item) => item.function)
						.filter((f) => f && f.trim() !== '');
					if (functions.length > 0) body.functions = functions;
				}

				return leadspickerApiRequest.call(
					context,
					'POST',
					'/autocph/by-company-linkedin',
					body,
					{},
				);
			}
			case 'byCompanyName': {
				const companyName = context.getNodeParameter('companyName', i) as string;
				const country = context.getNodeParameter('country', i, '') as string;
				const functionsCollection = context.getNodeParameter('functions', i, {}) as {
					functionValues?: { function: string }[];
				};
				const searchResultLimit = context.getNodeParameter('searchResultLimit', i, 2) as number;

				const body: IDataObject = {
					company_name: companyName,
					search_result_limit: searchResultLimit,
				};
				if (country) body.country = country;

				if (functionsCollection.functionValues?.length) {
					const functions = functionsCollection.functionValues
						.map((item) => item.function)
						.filter((f) => f && f.trim() !== '');
					if (functions.length > 0) body.functions = functions;
				}

				return leadspickerApiRequest.call(context, 'POST', '/autocph/by-company-name', body, {});
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for AutoCPH resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Linkedin Activity' resource.
	 */
	private static async handleLinkedinActivityOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'getProfile': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				return leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-profile', body);
			}
			case 'getPosts': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				return leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-posts', body);
			}
			case 'getActivities': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				return leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-activities', body);
			}
			case 'getPostReactors': {
				const webhookUrl = context.getNodeParameter('webhookUrl', i) as string;
				const profileUrls = context.getNodeParameter('profileUrls', i, {}) as {
					urls?: { url: string }[];
				};
				const options = context.getNodeParameter('postReactorsOptions', i, {}) as IDataObject;

				const body: IDataObject = {
					webhook_url: webhookUrl,
					max_posts_age: options.maxPostsAge ?? 90,
					max_posts_per_link: options.maxPostsPerLink ?? 30,
					max_reactors: options.maxReactors ?? 50,
				};

				if (profileUrls.urls?.length) {
					body.urls = profileUrls.urls
						.map((item) => item.url)
						.filter((url) => url && url.trim() !== '');
				}

				return leadspickerApiRequest.call(
					context,
					'POST',
					'/utils/linkedin-profile-posts-reactors',
					body,
				);
			}
			case 'searchPostReactors': {
				const searchUrl = context.getNodeParameter('searchUrl', i) as string;
				const options = context.getNodeParameter('reactorsSearchOptions', i, {}) as IDataObject;

				const baseBody: IDataObject = {
					search_url: searchUrl,
					include_author: (options.includeAuthor as boolean) ?? false,
					commenters_per_post: (options.commentersPerPost as number) ?? 0,
					likers_per_post: (options.likersPerPost as number) ?? 0,
					max_age_days: (options.maxAgeDays as number) ?? 90,
					posts_limit: (options.postsLimit as number) ?? 30,
					deduplicate: (options.deduplicate as boolean) ?? false,
				};

				let cursor: string | null = null;
				const results: IDataObject[] = [];

				for (let iter = 0; iter < 1000; iter++) {
					const body: IDataObject = { ...baseBody };
					if (cursor) body.cursor = cursor;
					const response = (await leadspickerApiRequest.call(
						context,
						'POST',
						'/utils/linkedin-profile-posts-reactors-search',
						body,
					)) as { results?: IDataObject[]; next_cursor?: string | null };

					const chunk = Array.isArray(response?.results) ? (response.results as IDataObject[]) : [];
					if (!chunk.length) break;
					results.push(...chunk);
					cursor = (response?.next_cursor as string | null) ?? null;
					if (!cursor) break;
				}

				return results;
			}
			case 'profilesPostReactors': {
				const profilesList = context.getNodeParameter('profilesList', i, {}) as {
					profiles?: { url: string }[];
				};
				const options = context.getNodeParameter('reactorsSearchOptions', i, {}) as IDataObject;

				const profiles = (profilesList.profiles || [])
					.map((p) => p.url)
					.filter((u) => u && u.trim() !== '');

				const baseBody: IDataObject = {
					profiles,
					include_author: (options.includeAuthor as boolean) ?? false,
					commenters_per_post: (options.commentersPerPost as number) ?? 0,
					likers_per_post: (options.likersPerPost as number) ?? 0,
					max_age_days: (options.maxAgeDays as number) ?? 90,
					posts_limit: (options.postsLimit as number) ?? 30,
					deduplicate: (options.deduplicate as boolean) ??  false,
				};

				let cursor: string | null = null;
				const results: IDataObject[] = [];

				for (let iter = 0; iter < 1000; iter++) {
					const body: IDataObject = { ...baseBody };
					if (cursor) body.cursor = cursor;
					const response = (await leadspickerApiRequest.call(
						context,
						'POST',
						'/utils/linkedin-profile-posts-reactors-profiles',
						body,
					)) as { results?: IDataObject[]; next_cursor?: string | null };

					const chunk = Array.isArray(response?.results) ? (response.results as IDataObject[]) : [];
					if (!chunk.length) break;
					results.push(...chunk);
					cursor = (response?.next_cursor as string | null) ?? null;
					if (!cursor) break;
				}

				return results;
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Linkedin resource.`,
				);
		}
	}

	/**
	 * The main execute method for the node.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				let responseData: any;

				switch (resource) {
					case 'person':
						responseData = await LeadspickerNode.handlePersonOperations(this, i);
						break;
					case 'project':
						responseData = await LeadspickerNode.handleProjectOperations(this, i);
						break;
					case 'reply':
						responseData = await LeadspickerNode.handleReplyOperations(this, i);
						break;
					case 'autocph':
						responseData = await LeadspickerNode.handleAutoCphOperations(this, i);
						break;
					case 'linkedinActivity':
						responseData = await LeadspickerNode.handleLinkedinActivityOperations(this, i);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`The resource "${resource}" is not supported!`,
						);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
