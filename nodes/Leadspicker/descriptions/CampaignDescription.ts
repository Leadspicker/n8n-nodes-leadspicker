import type { INodePropertyOptions, INodeProperties } from 'n8n-workflow';

import { getUserTimezone } from '../GenericFunctions';
import { MANUAL_ID_OPTION } from './Shared';

const getTimezones = (): string[] => {
	const intl = Intl as typeof Intl & {
		supportedValuesOf?: (key: 'timeZone') => string[];
	};

	if (typeof intl.supportedValuesOf === 'function') {
		return intl.supportedValuesOf('timeZone');
	}

	return [getUserTimezone()];
};

const TIMELINE_EVENT_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Project Paused', value: 'project_paused' },
	{ name: 'Project Started', value: 'project_started' },
	{ name: 'Sequence Step Completed', value: 'sequence_step_completed' },
	{ name: 'Sequence Step Skipped', value: 'sequence_step_skipped' },
	{ name: 'Sequence Step Error', value: 'sequence_step_error' },
	{ name: 'Sequence Journey Ended', value: 'sequence_journey_ended' },
	{ name: 'Message Sent', value: 'message_sent' },
	{ name: 'Reply Received', value: 'reply_received' },
	{ name: 'LinkedIn Connection Accepted', value: 'linkedin_connection_accepted' },
	{ name: 'LinkedIn Connection Withdrawn', value: 'linkedin_connection_withdrawn' },
	{ name: 'LinkedIn Already Connected', value: 'linkedin_already_connected' },
	{ name: 'LinkedIn Cannot Resend Yet', value: 'linkedin_cannot_resend_yet' },
	{ name: 'Bounced', value: 'bounced' },
	{ name: 'Delay Started', value: 'delay_started' },
	{ name: 'Unknown Event', value: 'unknown' },
	{ name: 'Custom Action Sending Failed', value: 'custom_action_error' },
	{ name: 'Custom Action Skipped', value: 'custom_action_skipped' },
	{ name: 'Email Reply', value: 'email_reply' },
	{ name: 'Email Sent', value: 'email_sent' },
	{ name: 'LinkedIn Connection Sent', value: 'linkedin_connection_sent' },
	{ name: 'LinkedIn Message Sent', value: 'linkedin_message_sent' },
	{ name: 'LinkedIn Message Reply', value: 'linkedin_message_reply' },
	{ name: 'LinkedIn InMail Sent', value: 'linkedin_inmail_sent' },
	{ name: 'LinkedIn InMail Reply', value: 'linkedin_inmail_reply' },
	{ name: 'Email Bounced', value: 'email_bounced' },
	{ name: 'Custom Action Sent', value: 'custom_action_sent' },
	{ name: 'LinkedIn Status Update', value: 'linkedin_status' },
];

const OUTREACH_STEP_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Email Message', value: '' },
	{ name: 'Connection Request', value: 'connect' },
	{ name: 'LinkedIn Message', value: 'message' },
	{ name: 'InMail Message', value: 'inmail_message' },
	{ name: 'Li Event Invitation', value: 'li_event_invite' },
	{ name: 'Li Follow', value: 'li_follow' },
	{ name: 'Custom Action', value: 'custom' },
	{ name: 'Delay', value: 'delay' },
	{ name: 'Magic Column Condition', value: 'magic_column_condition' },
	{ name: 'After Connection', value: 'after_connection' },
	{ name: 'Quick Follow-Up', value: 'quick_followup' },
	{ name: 'Has Email', value: 'has_email' },
	{ name: 'Has High-Confidence Email', value: 'has_high_confidence_email' },
	{ name: 'Has LinkedIn', value: 'has_linkedin' },
	{ name: 'Has Email or LinkedIn', value: 'has_email_or_linkedin' },
	{ name: 'Has Email and LinkedIn', value: 'has_email_and_linkedin' },
	{ name: 'First Degree Connection', value: 'first_degree_connection' },
];

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
				name: 'Add Lead to Campaign Exclusion List',
				value: 'addToExclusionList',
				description: 'Blacklist a lead identifier for a campaign',
				action: 'Add lead to exclusion list',
			},
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
			{
				name: 'Get Campaign Log',
				value: 'getCampaignLog',
				description: 'Retrieve campaign timeline events',
				action: 'Get campaign log',
			},
			{
				name: 'Get Exclusion List',
				value: 'getExclusionList',
				description: 'Retrieve all identifiers blacklisted for a campaign',
				action: 'Get exclusion list',
			},
			{
				name: 'Remove Lead From Campaign Exclusion List',
				value: 'removeFromExclusionList',
				description: 'Delete a specific identifier from a campaign blacklist',
				action: 'Remove lead from exclusion list',
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
		// Use a sentinel so "no filter" behaves like a selectable option.
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
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
		options: getTimezones().map((timezone) => ({
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
		// Use a sentinel so "no filter" behaves like a selectable option.
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
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
	{
		displayName: 'Campaign Name or ID',
		name: 'projectBlacklistId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['addToExclusionList', 'getExclusionList', 'removeFromExclusionList'],
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
		name: 'projectBlacklistIdManual',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['addToExclusionList', 'getExclusionList', 'removeFromExclusionList'],
				projectBlacklistId: [MANUAL_ID_OPTION],
			},
		},
		default: 0,
		description: 'ID of the campaign whose exclusion list will be updated or retrieved',
	},
	{
		displayName: 'Identifier to Exclude',
		name: 'blacklistEntry',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['addToExclusionList', 'removeFromExclusionList'],
			},
		},
		default: '',
		placeholder: 'linkedin.com/in/example, someone@example.com, example.com',
		description:
			'LinkedIn profile, email, domain, or company profile URL to add or remove from the exclusion list',
	},
	{
		displayName: 'Campaign Name or ID',
		name: 'projectLogId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
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
		name: 'projectLogIdManual',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
				projectLogId: [MANUAL_ID_OPTION],
			},
		},
		default: 0,
		description: 'ID of the campaign to fetch timeline events from',
	},
	{
		displayName: 'Person Name or ID',
		name: 'projectLogPersonId',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: '',
		typeOptions: {
			loadOptionsMethod: 'getLeads',
			loadOptionsDependsOn: ['projectLogId', 'projectLogIdManual'],
		},
		options: [
			{ name: 'Select a person...', value: '' },
			{ name: 'Enter Person ID manually...', value: MANUAL_ID_OPTION },
		],
		description:
			'Filter the timeline by a specific person. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Person ID',
		name: 'projectLogPersonIdManual',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
				projectLogPersonId: [MANUAL_ID_OPTION],
			},
		},
		default: '',
		description: 'Person ID to use when filtering the campaign log manually',
	},
	{
		displayName: 'Fulltext Search',
		name: 'projectLogSearch',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: '',
		description: 'Search inside the log entries (matches text, label, etc.)',
	},
	{
		displayName: 'Start Date',
		name: 'projectLogStartDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: '',
		description: 'Return events occurring on or after this date',
	},
	{
		displayName: 'End Date',
		name: 'projectLogEndDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: '',
		description: 'Return events occurring on or before this date',
	},
	{
		displayName: 'Event Types',
		name: 'projectLogEventTypes',
		type: 'multiOptions',
		options: TIMELINE_EVENT_TYPE_OPTIONS,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: [],
		description: 'Limit results to specific timeline event types',
	},
	{
		displayName: 'Outreach Step Types',
		name: 'projectLogOutreachStepTypes',
		type: 'multiOptions',
		options: OUTREACH_STEP_TYPE_OPTIONS,
		displayOptions: {
			show: {
				resource: ['project'],
				operation: ['getCampaignLog'],
			},
		},
		default: [],
		description: 'Limit results to specific outreach steps',
	},
];
