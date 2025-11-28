import type { INodeProperties } from 'n8n-workflow';

export const outreachOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['outreach'],
			},
		},
		options: [
			{
				name: 'Get LinkedIn Accounts',
				value: 'getLinkedinAccounts',
				description: 'Retrieve all connected outreach LinkedIn accounts',
				action: 'Get linkedin accounts',
			},
			{
				name: 'Get Email Accounts',
				value: 'getEmailAccounts',
				description: 'Retrieve all configured outreach email accounts',
				action: 'Get email accounts',
			},
		],
		default: 'getLinkedinAccounts',
	},
];
