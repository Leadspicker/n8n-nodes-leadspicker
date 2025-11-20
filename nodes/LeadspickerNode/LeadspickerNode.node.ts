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
	GenericValue,
} from 'n8n-workflow';

import * as moment from 'moment-timezone';
import { leadspickerApiRequest, getUserTimezone, logToConsole } from './GenericFunctions';

// Interfaces remain the same...
interface IEmailAccountItem {
	address: string;
}
interface IEmailAccountsFilter {
	email: IEmailAccountItem[];
}
interface ICampaignItem {
	id: number | string;
	idManual?: number;
}
interface ICampaignsFilter {
	project: ICampaignItem[];
}
interface ISentimentItem {
	type: string;
}
interface ISentimentFilter {
	sentiment_value: ISentimentItem[];
}

const MANUAL_ID_OPTION = '__manual__';
const DEFAULT_PAGE_SIZE = 1000;

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

	private static tryGetIdFromParameters(
		params: IDataObject,
		optionName: string,
		manualName: string,
	): number | undefined {
		const selection = params[optionName];
		if (selection === undefined || selection === null || selection === '') {
			return undefined;
		}
		if (selection === MANUAL_ID_OPTION) {
			return LeadspickerNode.toNumericId(params[manualName]);
		}
		return LeadspickerNode.toNumericId(selection);
	}

	private static getCampaignIdForLeadOptions(context: ILoadOptionsFunctions): number | undefined {
		const params = (context.getCurrentNodeParameters?.() ?? {}) as IDataObject;
		return (
			LeadspickerNode.tryGetIdFromParameters(
				params,
				'personLookupProjectId',
				'personLookupProjectIdManual',
			) ?? LeadspickerNode.tryGetIdFromParameters(params, 'projectId', 'projectIdManual')
		);
	}

	private static isPlainObject(value: unknown): value is IDataObject {
		return Object.prototype.toString.call(value) === '[object Object]';
	}

	private static isAttributeValueObject(value: unknown): value is { value: unknown } {
		if (!LeadspickerNode.isPlainObject(value)) return false;
		if (!Object.prototype.hasOwnProperty.call(value, 'value')) return false;
		const allowedKeys = new Set([
			'value',
			'created',
			'id',
			'enrichment_status',
			'validation_status',
		]);
		return Object.keys(value).every((key) => allowedKeys.has(key));
	}

	private static hasMeaningfulValue(value: unknown): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value === 'string') {
			return value.trim() !== '';
		}
		return true;
	}

	private static flattenLeadPayload(data: unknown): unknown {
		if (Array.isArray(data)) {
			return data.map((entry) => LeadspickerNode.flattenLeadPayload(entry));
		}
		if (!LeadspickerNode.isPlainObject(data)) {
			return data;
		}

		if (LeadspickerNode.isAttributeValueObject(data)) {
			return LeadspickerNode.flattenLeadPayload(data.value);
		}

		const clone: IDataObject = { ...data };
		const contactData = clone.contact_data as IDataObject | undefined;
		if (LeadspickerNode.isPlainObject(contactData)) {
			for (const [key, value] of Object.entries(contactData)) {
				if (!LeadspickerNode.hasMeaningfulValue(clone[key])) {
					clone[key] = value;
				}
			}
			delete clone.contact_data;
		}
		const personData = clone.person_data as IDataObject | undefined;
		if (LeadspickerNode.isPlainObject(personData)) {
			for (const [key, value] of Object.entries(personData)) {
				if (!LeadspickerNode.hasMeaningfulValue(clone[key])) {
					clone[key] = value;
				}
			}
			delete clone.person_data;
		}

		for (const [key, value] of Object.entries(clone)) {
			if (Array.isArray(value) || LeadspickerNode.isPlainObject(value)) {
				const normalizedValue = LeadspickerNode.flattenLeadPayload(value) as
					| GenericValue
					| IDataObject
					| GenericValue[]
					| IDataObject[];
				clone[key] = normalizedValue;
			}
		}

		return clone;
	}

	private static extractItemsFromFinderResponse(response: unknown, key_name: string): IDataObject[] {
		if (!LeadspickerNode.isPlainObject(response)) return [];

		const items: IDataObject[] = [];
		if (Array.isArray(response[key_name])) {
			items.push(...(response[key_name] as IDataObject[]));
		}
		return items;
	}

	methods = {
		loadOptions: {
			async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const query: IDataObject = { limit: 50 };
				const response = await leadspickerApiRequest.call(this, 'GET', '/projects', {}, query);
				const list = Array.isArray(response)
					? (response as IDataObject[])
					: Array.isArray((response as IDataObject)?.results)
						? ((response as IDataObject).results as IDataObject[])
						: [];
				const options: INodePropertyOptions[] = [];
				for (const campaign of list) {
					const id = LeadspickerNode.toNumericId(campaign?.id as NodeParameterValueType);
					if (id === undefined) continue;
					const name =
						typeof campaign?.name === 'string' && campaign.name.trim() !== ''
							? campaign.name.trim()
							: `Campaign #${id}`;
					options.push({ name, value: id.toString() });
				}
				return options;
			},
			async getLeads(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const projectId = LeadspickerNode.getCampaignIdForLeadOptions(this);
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
				for (const lead of list) {
					const id = LeadspickerNode.toNumericId(lead?.id as NodeParameterValueType);
					if (id === undefined) continue;
					const leadData = (lead?.person_data ?? {}) as IDataObject;
					const firstName = [leadData.first_name, lead?.first_name].find(
						(name) => typeof name === 'string' && name.trim() !== '',
					) as string | undefined;
					const lastName = [leadData.last_name, lead?.last_name].find(
						(name) => typeof name === 'string' && name.trim() !== '',
					) as string | undefined;
					const fullName =
						typeof leadData.full_name === 'string' && leadData.full_name.trim() !== ''
							? leadData.full_name.trim()
							: [firstName, lastName]
									.filter((val) => typeof val === 'string')
									.map((val) => (val as string).trim())
									.filter((val) => val !== '')
									.join(' ');
					const emailCandidate = [leadData.email, lead?.email].find(
						(addr) => typeof addr === 'string' && addr.trim() !== '',
					) as string | undefined;
					const name = fullName || emailCandidate || `Lead #${id}`;
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
		subtitle:
			'={{( { person: "Lead", project: "Campaign", reply: "Reply", linkedinActivity: "Linkedin" }[$parameter["resource"]] ?? $parameter["resource"]) + ": " + $parameter["operation"]}}',
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
						name: 'Campaign',
						value: 'project',
					},
					{
						name: 'Lead',
						value: 'person',
					},
					{
						name: 'Linkedin',
						value: 'linkedinActivity',
					},
					{
						name: 'Reply',
						value: 'reply',
					},
				],
				default: 'project',
			},

			// Lead Operations
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
						name: 'Create Lead',
						value: 'create',
						description: 'Create a new lead in a campaign',
						action: 'Create a lead',
					},
					{
						name: 'Delete Lead',
						value: 'delete',
						description: 'Delete a lead',
						action: 'Delete a lead',
					},
					{
						name: 'Find by Company Linkedin',
						value: 'byCompanyLinkedin',
						description: 'Find leads by a company LinkedIn URL',
						action: 'Find leads by company profile',
					},
					{
						name: 'Find by Company Name',
						value: 'byCompanyName',
						description: 'Find leads by a company name',
						action: 'Find leads by company name',
					},
					{
						name: 'Get Lead',
						value: 'get',
						description: 'Get a lead by ID',
						action: 'Get a lead',
					},
					{
						name: 'List Leads',
						value: 'list',
						description: 'List leads in a campaign',
						action: 'List leads',
					},
					{
						name: 'Update Lead',
						value: 'update',
						description: 'Update an existing lead',
						action: 'Update a lead',
					},
				],
				default: 'create',
			},

			// Campaign Operations
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
						name: 'Create Campaign',
						value: 'create',
						description: 'Create a new campaign',
						action: 'Create a campaign',
					},
					{
						name: 'Delete Campaign',
						value: 'delete',
						description: 'Delete a campaign',
						action: 'Delete a campaign',
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
						description: 'Get replies for a lead',
						action: 'Get replies',
					},
				],
				default: 'list',
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
						action: 'Get recent profile activities',
					},
					{
						name: 'Get Interactions for Profiles',
						value: 'profilesPostReactors',
						description: 'Retrieve interactors for posts authored by specific LinkedIn profiles',
						action: 'Get interactors for profiles',
					},
					{
						name: 'Get Post Interactors',
						value: 'getPostReactors',
						description: 'Get people who interact with posts and send to a webhook',
						action: 'Get post interactors',
					},
					{
						name: 'Get Profile Details',
						value: 'getProfile',
						description: 'Scrapes and returns details for a LinkedIn profile',
						action: 'Get profile details',
					},
					{
						name: 'Get Recent Profile Posts',
						value: 'getPosts',
						description: "Get profile's recent posts",
						action: 'Get recent profile posts',
					},
					{
						name: 'Search Post Interactors',
						value: 'searchPostReactors',
						description:
							'Retrieve LinkedIn profiles that interacted with posts returned by a content search URL',
						action: 'Search post interactors',
					},
				],
				default: 'getProfile',
			},

			// Campaign Name field for create operation
			{
				displayName: 'Campaign Name',
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
				description: 'Name of the campaign to create',
			},

			{
				displayName: 'Campaign Timezone',
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
				description: 'Timezone of the campaign',
				displayOptions: {
					show: {
						resource: ['project'],
						operation: ['create'],
					},
				},
			},

			// Campaign selector for delete operation
			{
				displayName: 'Campaign Name or ID',
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
					loadOptionsMethod: 'getCampaigns',
				},
				options: [
					{ name: 'Select a campaign...', value: '' },
					{ name: 'Enter Campaign ID manually...', value: MANUAL_ID_OPTION },
				],
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Campaign ID',
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
				description: 'ID of the campaign to delete',
			},

			// Create Lead fields
			{
				displayName: 'Campaign Name or ID',
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
					{ name: 'Select a campaign...', value: '' },
					{ name: 'Enter Campaign ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getCampaigns',
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Campaign ID',
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
				description: 'ID of the campaign that contains the lead records',
			},

			// Lead lookup campaign for option list
			{
				displayName: 'Lead Lookup Campaign Name or ID',
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
					{ name: 'Select a campaign...', value: '' },
					{ name: 'Enter Campaign ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getCampaigns',
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Lead Lookup Campaign ID',
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
				description: 'Campaign ID to load leads from when entering manually',
			},

			// Lead ID field for get, update, delete operations
			{
				displayName: 'Lead Name or ID',
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
					{ name: 'Select a lead...', value: '' },
					{ name: 'Enter Lead ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getLeads',
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
				displayName: 'Lead ID',
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
				description: 'ID of the lead',
			},

			// Lead Details Section
			{
				displayName: 'Lead Details',
				name: 'personDetails',
				type: 'collection',
				placeholder: 'Add Lead Detail',
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
						description: 'Country of the lead',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						description: 'Email address of the lead',
					},
					{
						displayName: 'First Name',
						name: 'first_name',
						type: 'string',
						default: '',
						description: 'First name of the lead',
					},
					{
						displayName: 'Last Name',
						name: 'last_name',
						type: 'string',
						default: '',
						description: 'Last name of the lead',
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'string',
						default: '',
						description: 'Job position/title of the lead',
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
						description: 'Company name where the lead works',
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
						description: 'Lead LinkedIn URL',
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
						displayName: 'Campaigns',
						name: 'projects',
						type: 'fixedCollection',
						placeholder: 'Add Campaign',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Campaign IDs to filter by',
						options: [
							{
								displayName: 'Campaign',
								name: 'project',
								values: [
									{
										displayName: 'Campaign Name or ID',
										name: 'id',
										type: 'options',
										default: '',
										options: [
											{ name: 'Select a campaign...', value: '' },
											{ name: 'Enter Campaign ID manually...', value: MANUAL_ID_OPTION },
										],
										typeOptions: {
											loadOptionsMethod: 'getCampaigns',
										},
										description:
											'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
									},
									{
										displayName: 'Campaign ID',
										name: 'idManual',
										type: 'number',
										required: true,
										displayOptions: {
											show: {
												id: [MANUAL_ID_OPTION],
											},
										},
										default: 0,
										description: 'Campaign ID to filter by',
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
						resource: ['person'],
						operation: ['byCompanyName'],
					},
				},
				default: '',
				description: 'The name of the company to search for contacts in',
			},
			{
				displayName: 'Job Titles',
				name: 'functions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Job Title',
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['byCompanyLinkedin', 'byCompanyName'],
					},
				},
				default: {},
				description: 'Job titles/roles to filter by (e.g., CEO, Founder, Head of Sales)',
				options: [
					{
						name: 'functionValues',
						displayName: 'Job Title',
						values: [
							{
								displayName: 'Job Title',
								name: 'function',
								type: 'string',
								default: '',
								description: 'A job title/position, e.g., "CEO" or "Head of Sales"',
							},
						],
					},
				],
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['person'],
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
						resource: ['person'],
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
				displayName: 'Activity Section',
				name: 'includeActivityCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the recent activity section in the response',
			},
			{
				displayName: 'Adjacent Section',
				name: 'includeAdjacentCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the adjacent/related profiles section',
			},
			{
				displayName: 'Education Section',
				name: 'includeEducationCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the education section',
			},
			{
				displayName: 'Experience Section',
				name: 'includeExperienceCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the experience section',
			},
			{
				displayName: 'Followers Section',
				name: 'includeFollowersCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the follower stats section',
			},
			{
				displayName: 'Location Section',
				name: 'includeLocationCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the location information section',
			},
			{
				displayName: 'Overview Section',
				name: 'includeOverviewCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the overview/about section',
			},
			{
				displayName: 'Skills Section',
				name: 'includeSkillsCard',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['getProfile'],
					},
				},
				description: 'Whether to include the skills section',
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
				description: 'A list of LinkedIn profile URLs to get interactors from',
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
				displayName: 'Include Likers',
				name: 'includePostLikers',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['profilesPostReactors'],
					},
				},
				description: 'Whether to include likers per post (max 10 by default)',
			},
			{
				displayName: 'Include Commenters',
				name: 'includePostCommenters',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['linkedinActivity'],
						operation: ['profilesPostReactors'],
					},
				},
				description: 'Whether to include commenters per post (max 10 by default)',
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
				description: 'A list of LinkedIn profile URLs to get post interactors from',
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
				displayName: 'Post Interactors Options',
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
						displayName: 'Max Interactors per Post',
						name: 'maxReactors',
						type: 'number',
						default: 50,
						description: 'The maximum number of interactors to return per post',
					},
				],
			},
			{
				displayName: 'Interactors Search Options',
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
						description: 'Whether to deduplicate interactors across posts',
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
				displayName: 'Search Result Limit',
				name: 'searchResultLimit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['person'],
						operation: ['byCompanyLinkedin', 'byCompanyName'],
					},
				},
				default: 2,
				description: 'The maximum number of leads to return',
			},
			{
				displayName: 'Enrich with Emails',
				name: 'enrichEmails',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['person'],
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
						resource: ['person'],
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
							'Whether to perform a live check to verify if the lead currently works at the company (as data could be stale)',
					},
					{
						displayName: 'Use Embeddings Similarity',
						name: 'useEmbeddingsSimilarity',
						type: 'boolean',
						default: true,
						description:
							"Whether to use embeddings similarity to compare provided job titles with the leads' positions. Defaults to true.",
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
	 * Handles operations for the 'Lead' resource.
	 */
	private static async handleLeadOperations(context: IExecuteFunctions, i: number): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'list': {
				const campaignId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'projectId',
					'projectIdManual',
					'project',
					i,
				);
				const pageSize = DEFAULT_PAGE_SIZE;
				let page = 1;
				const persons: IDataObject[] = [];

				for (let iteration = 0; iteration < 1000; iteration++) {
					const qs: IDataObject = { project_id: campaignId, page_size: pageSize, page };
					const response = (await leadspickerApiRequest.call(
						context,
						'GET',
						`/persons-simple`,
						{},
						qs,
					)) as IDataObject;

					const chunk = Array.isArray(response?.items)
						? (response.items as IDataObject[])
						: Array.isArray(response?.results)
							? (response.results as IDataObject[])
							: Array.isArray(response)
								? (response as IDataObject[])
								: [];

					if (!chunk.length) break;
					persons.push(...chunk);

					if (typeof response?.count === 'number') {
						if (persons.length >= response.count) break;
					} else if (chunk.length < pageSize) {
						break;
					}

					page += 1;
				}

				return LeadspickerNode.flattenLeadPayload(persons);
			}
			case 'create':
			case 'update': {
				const leadDetails = context.getNodeParameter('personDetails', i) as IDataObject;
				const companyDetails = context.getNodeParameter('companyDetails', i) as IDataObject;
				const socialProfiles = context.getNodeParameter('socialProfiles', i) as IDataObject;
				const customFields = context.getNodeParameter('customFields', i) as IDataObject;
				const body: IDataObject = {
					data_source: 'user_provided',
					...leadDetails,
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
					const response = await leadspickerApiRequest.call(context, 'POST', '/persons', body);
					return LeadspickerNode.flattenLeadPayload(response);
				} else {
					const leadId = LeadspickerNode.getIdFromOptionOrManual(
						context,
						'personId',
						'personIdManual',
						'person',
						i,
					);
					const response = await leadspickerApiRequest.call(
						context,
						'PATCH',
						`/persons/${leadId}`,
						body,
					);
					return LeadspickerNode.flattenLeadPayload(response);
				}
			}
			case 'byCompanyLinkedin':
			case 'byCompanyName': {
				return LeadspickerNode.handleLeadFinderOperations(context, i);
			}
			case 'get': {
				const leadId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'personId',
					'personIdManual',
					'person',
					i,
				);
				const response = await leadspickerApiRequest.call(context, 'GET', `/persons/${leadId}`);
				return LeadspickerNode.flattenLeadPayload(response);
			}
			case 'delete': {
				const leadId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'personId',
					'personIdManual',
					'person',
					i,
				);
				return leadspickerApiRequest.call(context, 'DELETE', `/persons/${leadId}`);
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Lead resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Campaign' resource.
	 */
	private static async handleCampaignOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'create': {
				const campaignName = context.getNodeParameter('projectName', i) as string;
				const campaignTimezone = context.getNodeParameter('projectTimezone', i) as string;
				const body: IDataObject = { name: campaignName, timezone: campaignTimezone };
				return leadspickerApiRequest.call(context, 'POST', '/projects', body);
			}
			case 'delete': {
				const campaignId = LeadspickerNode.getIdFromOptionOrManual(
					context,
					'projectDeleteId',
					'projectDeleteIdManual',
					'project',
					i,
				);
				return leadspickerApiRequest.call(context, 'DELETE', `/projects/${campaignId}`);
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Campaign resource.`,
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

			const campaignsFilter = filters.projects as ICampaignsFilter;
			if (campaignsFilter?.project?.length) {
				campaignsFilter.project
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

			const baseQueryParts = rawQueryParts;
			const limit = DEFAULT_PAGE_SIZE;
			let offset = 0;
			const replies: IDataObject[] = [];

			for (let iteration = 0; iteration < 1000; iteration++) {
				const queryParts = [...baseQueryParts, `limit=${limit}`, `offset=${offset}`];
				let path = '/inbound-messages';
				if (queryParts.length > 0) path += '?' + queryParts.join('&');

				const response = (await leadspickerApiRequest.call(
					context,
					'GET',
					path,
					{},
					{},
				)) as IDataObject;

				const chunk = Array.isArray(response?.items)
					? (response.items as IDataObject[])
					: Array.isArray(response?.results)
						? (response.results as IDataObject[])
						: Array.isArray(response)
							? (response as IDataObject[])
							: [];

				if (!chunk.length) break;
				replies.push(...chunk);

				if (typeof response?.count === 'number' && replies.length >= response.count) break;
				if (chunk.length < limit) break;

				offset += limit;
			}

			return replies;
		}

		throw new NodeOperationError(
			context.getNode(),
			`The operation "${operation}" is not supported for Reply resource.`,
		);
	}

	/**
	 * Handles "find a lead" operations that search by company data.
	 */
	private static async handleLeadFinderOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'byCompanyLinkedin': {
				const companyLinkedin = context.getNodeParameter('companyLinkedin', i) as string;
				const jobTitlesCollection = context.getNodeParameter('functions', i, {}) as {
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

				if (jobTitlesCollection.functionValues?.length) {
					const jobTitles = jobTitlesCollection.functionValues
						.map((item) => item.function)
						.filter((f) => f && f.trim() !== '');
					if (jobTitles.length > 0) body.functions = jobTitles;
				}

				const response = await leadspickerApiRequest.call(
					context,
					'POST',
					'/autocph/by-company-linkedin',
					body,
					{},
				);
				return LeadspickerNode.extractItemsFromFinderResponse(response, "persons");
			}
			case 'byCompanyName': {
				const companyName = context.getNodeParameter('companyName', i) as string;
				const country = (context.getNodeParameter('country', i, '') as string).trim();
				const jobTitlesCollection = context.getNodeParameter('functions', i, {}) as {
					functionValues?: { function: string }[];
				};
				const searchResultLimit = context.getNodeParameter('searchResultLimit', i, 2) as number;
				const enrichEmails = context.getNodeParameter('enrichEmails', i, false) as boolean;

				const body: IDataObject = {
					company_name: companyName,
					search_result_limit: searchResultLimit,
					enrich_emails: enrichEmails,
				};
				if (country !== '') body.country = country;

				if (jobTitlesCollection.functionValues?.length) {
					const jobTitles = jobTitlesCollection.functionValues
						.map((item) => item.function)
						.filter((f) => f && f.trim() !== '');
					if (jobTitles.length > 0) body.functions = jobTitles;
				}

				const response = await leadspickerApiRequest.call(
					context,
					'POST',
					'/autocph/by-company-name',
					body,
					{},
				);
				return LeadspickerNode.extractItemsFromFinderResponse(response, "persons");
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for lead finder operations.`,
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
					const selectableCards: Array<{ apiValue: string; paramName: string }> = [
						{ apiValue: 'activity', paramName: 'includeActivityCard' },
						{ apiValue: 'adjacent', paramName: 'includeAdjacentCard' },
						{ apiValue: 'education', paramName: 'includeEducationCard' },
						{ apiValue: 'experience', paramName: 'includeExperienceCard' },
						{ apiValue: 'followers', paramName: 'includeFollowersCard' },
						{ apiValue: 'location', paramName: 'includeLocationCard' },
						{ apiValue: 'overview', paramName: 'includeOverviewCard' },
						{ apiValue: 'skills', paramName: 'includeSkillsCard' },
					];
					const selectedCards = selectableCards
						.filter((card) => context.getNodeParameter(card.paramName, i, false) as boolean)
						.map((card) => card.apiValue);
					if (selectedCards.length) body.cards = selectedCards;
					return leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-profile', body);
				}
			case 'getPosts': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				const response = await leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-posts', body);
				return LeadspickerNode.extractItemsFromFinderResponse(response, "posts");
			}
			case 'getActivities': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				const response = await leadspickerApiRequest.call(context, 'POST', '/utils/linkedin-activities', body);
				return LeadspickerNode.extractItemsFromFinderResponse(response, "activities");
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
					const includePostLikers = context.getNodeParameter('includePostLikers', i, false) as boolean;
					const includePostCommenters = context.getNodeParameter('includePostCommenters', i, false) as boolean;
					const options = context.getNodeParameter('reactorsSearchOptions', i, {}) as IDataObject;

					const profiles = (profilesList.profiles || [])
						.map((p) => p.url)
						.filter((u) => u && u.trim() !== '');

					const commentersPerPost = includePostCommenters
						? 10
						: ((options.commentersPerPost as number) ?? 0);
					const likersPerPost = includePostLikers ? 10 : ((options.likersPerPost as number) ?? 0);
					const baseBody: IDataObject = {
						profiles,
						include_author: (options.includeAuthor as boolean) ?? false,
						commenters_per_post: commentersPerPost,
						likers_per_post: likersPerPost,
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
						responseData = await LeadspickerNode.handleLeadOperations(this, i);
						break;
					case 'project':
						responseData = await LeadspickerNode.handleCampaignOperations(this, i);
						break;
					case 'reply':
						responseData = await LeadspickerNode.handleReplyOperations(this, i);
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
