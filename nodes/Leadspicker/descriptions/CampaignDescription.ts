import * as moment from 'moment-timezone';
import type { INodeProperties } from 'n8n-workflow';

import { getUserTimezone } from '../GenericFunctions';
import { MANUAL_ID_OPTION } from './Shared';

export const campaignOperations: INodeProperties[] = [
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
];

export const campaignFields: INodeProperties[] = [
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
];
