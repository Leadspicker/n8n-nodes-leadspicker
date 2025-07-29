import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
	NodeConnectionType,
} from 'n8n-workflow';

import * as moment from 'moment-timezone';
import { leadspickerApiRequest, getUserTimezone } from './GenericFunctions';

/**
 * Describes the structure of a single item in the email accounts list.
 */
interface IEmailAccountItem {
	address: string;
}

/**
 * Describes the structure of the 'email_accounts' filter property.
 * It contains a list of email account items.
 */
interface IEmailAccountsFilter {
	email: IEmailAccountItem[];
}

/**
 * Describes the structure of a single item in the projects list.
 */
interface IProjectItem {
	id: number;
}

/**
 * Describes the structure of the 'projects' filter property.
 */
interface IProjectsFilter {
	project: IProjectItem[];
}

/**
 * Describes the structure of a single item in the sentiment list.
 */
interface ISentimentItem {
	type: string;
}

/**
 * Describes the structure of the 'sentiment' filter property.
 */
interface ISentimentFilter {
	sentiment_value: ISentimentItem[];
}

export class LeadspickerNode implements INodeType {
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
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'leadspickerApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'http://localhost:8000/app/sb/api',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// Resource Property
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
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
					{
						name: 'AutoCPH',
						value: 'autocph',
					},
					// Future resources can be added here (Project, Campaign, etc.)
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

			// Project ID field for delete operation
			{
				displayName: 'Project ID',
				name: 'projectDeleteId',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['delete'],
					},
				},
				default: 0,
				description: 'ID of the project to delete',
			},

			// Create Person fields
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['create', 'list'],
					},
				},
				default: 0,
				description: 'ID of the project to create the person in',
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

			// Person ID field for get, update, delete operations
			{
				displayName: 'Person ID',
				name: 'personId',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['get', 'update', 'delete'],
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
										displayName: 'Project ID',
										name: 'id',
										type: 'number',
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
				description: 'The LinkedIn URL or handle of the company to search for contacts in',
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
	 * Note: This is now a static method.
	 */
	private static async handlePersonOperations(context: IExecuteFunctions, i: number): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'list': {
				const projectId = context.getNodeParameter('projectId', i) as number;
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
					body.project_id = context.getNodeParameter('projectId', i) as number;
					return leadspickerApiRequest.call(context, 'POST', '/persons', body);
				} else {
					const personId = context.getNodeParameter('personId', i) as number;
					return leadspickerApiRequest.call(context, 'PATCH', `/persons/${personId}`, body);
				}
			}
			case 'get': {
				const personId = context.getNodeParameter('personId', i) as number;
				return leadspickerApiRequest.call(context, 'GET', `/persons-simple/${personId}`);
			}
			case 'delete': {
				const personId = context.getNodeParameter('personId', i) as number;
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
	 * Note: This is now a static method.
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
				const projectId = context.getNodeParameter('projectDeleteId', i) as number;
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
	 * Note: This is now a static method.
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
				const projectIds = projectsFilter.project
					.map((item) => item.id)
					.filter((id) => id !== null && id !== undefined && id !== 0);
				projectIds.forEach((id) => rawQueryParts.push(`projects=${encodeURIComponent(id)}`));
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
	 * Note: This is now a static method.
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
