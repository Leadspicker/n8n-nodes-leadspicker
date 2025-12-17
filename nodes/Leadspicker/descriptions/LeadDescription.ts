import type { INodeProperties } from 'n8n-workflow';

import { MANUAL_ID_OPTION } from './Shared';

export const leadOperations: INodeProperties[] = [
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
				name: 'Bulk Create Leads',
				value: 'bulkCreate',
				description: 'Create multiple leads in a campaign',
				action: 'Bulk create leads',
			},
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
];

export const leadFields: INodeProperties[] = [
	{
		displayName: 'Campaign Name or ID',
		name: 'projectId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'list', 'bulkCreate'],
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
				operation: ['create', 'list', 'bulkCreate'],
				projectId: [MANUAL_ID_OPTION],
			},
		},
		default: 0,
		description: 'ID of the campaign that contains the lead records',
	},
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
	{
		displayName: 'Country',
		name: 'leadCountry',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Country of the lead',
	},
	{
		displayName: 'Full Name',
		name: 'leadFullName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description:
			'Full name of the lead (overrides First/Last name when at least two words are provided)',
	},
	{
		displayName: 'Email',
		name: 'leadEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Email address of the lead',
	},
	{
		displayName: 'First Name',
		name: 'leadFirstName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'First name of the lead',
	},
	{
		displayName: 'Last Name',
		name: 'leadLastName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Last name of the lead',
	},
	{
		displayName: 'Position',
		name: 'leadPosition',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Job position/title of the lead',
	},
	{
		displayName: 'Company Name',
		name: 'leadCompanyName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Company name where the lead works',
	},
	{
		displayName: 'Company Website',
		name: 'leadCompanyWebsite',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Company website URL',
	},
	{
		displayName: 'Company LinkedIn',
		name: 'leadCompanyLinkedin',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Company LinkedIn URL',
	},
	{
		displayName: 'Lead LinkedIn',
		name: 'leadLinkedin',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'Lead LinkedIn URL',
	},
	{
		displayName: 'Sales Navigator',
		name: 'leadSalesNavigator',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['create', 'update'],
			},
		},
		description: 'LinkedIn Sales Navigator URL',
	},
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
	{
		displayName: 'Leads',
		name: 'bulkLeads',
		type: 'fixedCollection',
		placeholder: 'Add Lead',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		required: true,
		displayOptions: {
			show: {
				resource: ['person'],
				operation: ['bulkCreate'],
			},
		},
		options: [
			{
				name: 'lead',
				displayName: 'Lead',
				values: [
					{
						displayName: 'Company LinkedIn',
						name: 'company_linkedin',
						type: 'string',
						default: '',
						description: 'Company LinkedIn URL',
					},
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
						displayName: 'Country',
						name: 'country',
						type: 'string',
						default: '',
						description: 'Country of the lead',
					},
					{
						displayName: 'Custom Fields',
						name: 'customFields',
						type: 'fixedCollection',
						placeholder: 'Add Custom Field',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
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
						displayName: 'Lead LinkedIn',
						name: 'linkedin',
						type: 'string',
						default: '',
						description: 'Lead LinkedIn URL',
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'string',
						default: '',
						description: 'Job position/title of the lead',
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
		],
	},
];

export const leadFinderInputFields: INodeProperties[] = [
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
];

export const leadFinderFields: INodeProperties[] = [
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
];
