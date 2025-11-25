import type { INodeProperties } from 'n8n-workflow';

import { MANUAL_ID_OPTION } from './Shared';

export const replyOperations: INodeProperties[] = [
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
];

export const replyFields: INodeProperties[] = [
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
						name: 'email',
						displayName: 'Email',
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
						name: 'project',
						displayName: 'Campaign',
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
						name: 'sentiment_value',
						displayName: 'Sentiment',
						values: [
							{
								displayName: 'Sentiment Type',
								name: 'type',
								type: 'options',
								default: 'positive',
								options: [
									{ name: 'Interested', value: 'interested' },
									{ name: 'Negative', value: 'negative' },
									{ name: 'Neutral', value: 'neutral' },
									{ name: 'Not Interested', value: 'not_interested' },
									{ name: 'Positive', value: 'positive' },
								],
								description: 'Sentiment type to filter by',
							},
						],
					},
				],
			},
		],
	},
];
