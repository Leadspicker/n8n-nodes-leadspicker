import type { INodeProperties } from 'n8n-workflow';

export const globalExclusionListOperations: INodeProperties[] = [
	{
		displayName: 'Global Exclusion List Actions',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['globalExclusionList'],
			},
		},
		options: [
			{
				name: 'Add Lead to Global Exclusion List',
				value: 'addLead',
				description: 'Blacklist an identifier for the entire organization',
				action: 'Add lead to global exclusion list',
			},
			{
				name: 'Remove Lead From Global Exclusion List',
				value: 'removeLead',
				description: 'Delete a specific identifier from the global blacklist',
				action: 'Remove lead from global exclusion list',
			},
			{
				name: 'Get Global Exclusion List',
				value: 'get',
				description: 'Retrieve the global text-based blacklist for the authenticated organization',
				action: 'Get global exclusion list',
			},
		],
		default: 'get',
	},
];

export const globalExclusionListFields: INodeProperties[] = [
	{
		displayName: 'Identifier to Exclude',
		name: 'globalBlacklistEntry',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'linkedin.com/in/example, someone@example.com, example.com',
		description:
			'LinkedIn profile, email, domain, or company profile URL to add to the global exclusion list',
		displayOptions: {
			show: {
				resource: ['globalExclusionList'],
				operation: ['addLead', 'removeLead'],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'globalExclusionListFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['globalExclusionList'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Team Member ID',
				name: 'memberId',
				type: 'number',
				default: 0,
				description:
					'Limit the blacklist to a specific team member. Leave empty to fetch the organization-wide blacklist.',
			},
		],
	},
];
