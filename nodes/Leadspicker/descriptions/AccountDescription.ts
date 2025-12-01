import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Account Actions',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['account'],
			},
		},
		options: [
			{
				name: 'Get Account Info',
				value: 'getInfo',
				action: 'Get account info',
				description: 'Retrieve details about the current account and organization quotas',
			},
		],
		default: 'getInfo',
	},
];

export const accountFields: INodeProperties[] = [];
