import type {
	IDataObject,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeParameterValueType,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { isPlainObject, leadspickerApiRequest, logToConsole } from './GenericFunctions';

const MANUAL_ID_OPTION = '__manual__';
const WEBHOOK_PATH = 'leadspicker';
const WEBHOOK_NAME_FALLBACK = 'Leadspicker Webhook';

const FEATURE_OPTIONS = [
	{ name: 'Account Revoked', value: 'account_revoked', description: 'Linked account was revoked' },
	{ name: 'Email Bounced', value: 'email_bounced', description: 'Leadspicker reports a bounced email' },
	{ name: 'Email Reply', value: 'email_reply', description: 'Reply received on a sent email' },
	{ name: 'Email Sent', value: 'email_sent', description: 'Trigger when Leadspicker delivers an email' },
	{ name: 'LinkedIn Reply', value: 'linkedin_reply', description: 'Reply received on LinkedIn' },
	{ name: 'LinkedIn Sent', value: 'linkedin_sent', description: 'LinkedIn outreach sent' },
	{ name: 'Lead Added', value: 'person_added', description: 'Trigger when a new lead is added to the project' },
] as const;

type FeatureName = (typeof FEATURE_OPTIONS)[number]['value'];

interface WebhookRecord extends IDataObject {
	id?: number | string | null;
	url?: string;
	features?: Array<string | null>;
	project_ids?: Array<number | string | null> | null;
}

function toNumericId(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function getProjectIdIfSelected(context: IHookFunctions | IWebhookFunctions): number | undefined {
	const selection = context.getNodeParameter('projectId') as NodeParameterValueType;
	if (selection === MANUAL_ID_OPTION) {
		const manualValue = context.getNodeParameter('projectIdManual');
		const id = toNumericId(manualValue);
		if (id === undefined) {
			throw new NodeOperationError(context.getNode(), 'Please enter a valid project ID.');
		}
		return id;
	}
	if (selection === undefined || selection === null || selection === '') {
		return undefined;
	}
	const id = toNumericId(selection);
	if (id === undefined) {
		throw new NodeOperationError(context.getNode(), 'Please select a project.');
	}
	return id;
}

function getSelectedFeature(context: IHookFunctions | IWebhookFunctions): FeatureName {
	return context.getNodeParameter('feature') as FeatureName;
}

function normalizeWebhookList(payload: unknown): WebhookRecord[] {
	if (Array.isArray(payload)) {
		return payload as WebhookRecord[];
	}
	if (typeof payload === 'object' && payload !== null) {
		const data = payload as IDataObject;
		if (Array.isArray(data.results)) {
			return data.results as WebhookRecord[];
		}
		if (Array.isArray(data.items)) {
			return data.items as WebhookRecord[];
		}
	}
	return [];
}

function extractWebhookId(record: unknown): number | undefined {
	if (typeof record === 'object' && record !== null) {
		const idCandidate = (record as IDataObject).id;
		return toNumericId(idCandidate);
	}
	return toNumericId(record);
}


function flattenPerson(person: unknown): IDataObject | undefined {
	if (!isPlainObject(person)) {
		return undefined;
	}
	const flattened: IDataObject = {};
	const details = isPlainObject(person.person_data) ? (person.person_data as IDataObject) : undefined;
	if (details) {
		for (const [key, value] of Object.entries(details)) {
			flattened[key] = value as IDataObject;
		}
	}
	for (const [key, value] of Object.entries(person)) {
		if (key === 'person_data') continue;
		flattened[key] = value as IDataObject;
	}
	return flattened;
}

function extractPersonsFromBody(body: unknown): IDataObject[] {
	const persons: IDataObject[] = [];
	if (!isPlainObject(body)) {
		return persons;
	}
	const personPayload = body.person ?? body.persons;
	if (Array.isArray(personPayload)) {
		for (const entry of personPayload) {
			const flattened = flattenPerson(entry);
			if (flattened) {
				persons.push(flattened);
			}
		}
	} else {
		const flattened = flattenPerson(personPayload ?? body);
		if (flattened) {
			persons.push(flattened);
		}
	}
	return persons;
}

function normalizeRequestBody(body: unknown): IDataObject {
	if (!isPlainObject(body)) {
		return (body ?? {}) as IDataObject;
	}
	const payload = { ...body } as IDataObject;
	if (isPlainObject(payload.person)) {
		const flattened = flattenPerson(payload.person);
		if (flattened) {
			payload.person = flattened;
		}
	}
	return payload;
}

function formatRequestPayload(this: IWebhookFunctions): IDataObject {
	const request = this.getRequestObject();
	return normalizeRequestBody(request.body ?? {});
}

function buildWebhookOutput(this: IWebhookFunctions, feature: FeatureName): IDataObject[] {
	switch (feature) {
		case 'person_added': {
			const request = this.getRequestObject();
			return extractPersonsFromBody(request.body);
		}
		case 'email_sent':
		default:
			return [formatRequestPayload.call(this)];
	}
}

export class LeadspickerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Leadspicker Trigger',
		name: 'leadspickerTrigger',
		icon: 'file:logo_leadspicker.svg',
		group: ['trigger'],
		version: 1,
		description: 'Receive Leadspicker webhook events for multiple features',
		defaults: {
			name: 'Leadspicker Trigger',
		},
		inputs: [],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 'leadspickerApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: WEBHOOK_PATH,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'feature',
				type: 'options',
				required: true,
				default: '',
				noDataExpression: true,
				options: FEATURE_OPTIONS.map((option) => ({
					name: option.name,
					value: option.value,
					description: option.description,
				})),
				description: 'Leadspicker event type to subscribe to',
			},
			{
				displayName: 'Webhook Name',
				name: 'webhookName',
				type: 'string',
				default: WEBHOOK_NAME_FALLBACK,
				description: 'Name that will be displayed in Leadspicker for the created webhook',
			},
			{
				displayName: 'Project Name or ID',
				name: 'projectId',
				type: 'options',
				default: '',
				options: [
					{ name: 'All Projects (Default)', value: '' },
					{ name: 'Enter Project ID manually...', value: MANUAL_ID_OPTION },
				],
				typeOptions: {
					loadOptionsMethod: 'getCampaigns',
				},
				description: 'Choose from the list, specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>, or leave empty to listen to all projects. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Project ID',
				name: 'projectIdManual',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						projectId: [MANUAL_ID_OPTION],
					},
				},
				default: 0,
				description: 'Project ID to filter events by',
			},
		],
	};

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
					const id = toNumericId(campaign?.id as NodeParameterValueType);
					if (id === undefined) continue;
					const name =
						typeof campaign?.name === 'string' && campaign.name.trim() !== ''
							? campaign.name.trim()
							: `Campaign #${id}`;
					options.push({ name, value: id.toString() });
				}
				return options;
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const feature = getSelectedFeature(this);
				logToConsole(`Checking if webhook with URL "${webhookUrl}" exists...`, { webhookUrl, feature });
				const projectId = getProjectIdIfSelected(this);
				const response = await leadspickerApiRequest.call(this, 'GET', '/webhooks');
				const availableWebhooks = normalizeWebhookList(response);
				const match = availableWebhooks.find((entry) => {
					if (typeof entry.url !== 'string' || entry.url !== webhookUrl) {
						return false;
					}
					if (!Array.isArray(entry.features) || !entry.features.includes(feature)) {
						return false;
					}
					const projectIds = Array.isArray(entry.project_ids) ? entry.project_ids : null;
					if (projectId === undefined) {
						return !projectIds || projectIds.length === 0;
					}
					if (!projectIds) {
						return false;
					}
					return projectIds.some((value) => toNumericId(value) === projectId);
				});
				if (!match) {
					return false;
				}
				const id = extractWebhookId(match);
				if (id !== undefined) {
					const staticData = this.getWorkflowStaticData('node');
					staticData.webhookId = id;
				}
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const feature = getSelectedFeature(this);
				logToConsole('Creating Leadspicker webhook...', { feature });
				const webhookUrl = this.getNodeWebhookUrl('default');
				const projectId = getProjectIdIfSelected(this);
				const webhookName = (this.getNodeParameter('webhookName') as string)?.trim() || WEBHOOK_NAME_FALLBACK;
				const payload: IDataObject = {
					name: webhookName,
					url: webhookUrl,
					features: [feature],
				};
				if (projectId !== undefined) {
					payload.project_ids = [projectId];
				}
				const response = await leadspickerApiRequest.call(this, 'POST', '/webhooks', payload);
				const webhookId = extractWebhookId(response);
				if (webhookId === undefined) {
					throw new NodeOperationError(this.getNode(), 'Leadspicker did not return a webhook ID.');
				}
				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookId = webhookId;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				logToConsole('Deleting Leadspicker webhook...', {});
				const staticData = this.getWorkflowStaticData('node') as IDataObject & { webhookId?: number };
				const webhookId = staticData.webhookId;
				if (webhookId === undefined) {
					return true;
				}
				try {
					await leadspickerApiRequest.call(this, 'DELETE', `/webhooks/${webhookId}`);
				} catch (error) {
					const httpCode =
						typeof error === 'object' && error !== null && 'httpCode' in error
							? (error as { httpCode?: unknown }).httpCode
							: undefined;
					if (httpCode !== '404') {
						throw error;
					}
				}
				delete staticData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const feature = getSelectedFeature(this);
		logToConsole('Received Leadspicker webhook event', { feature });
		const payloads = buildWebhookOutput.call(this, feature);
		const executionData: INodeExecutionData[] = this.helpers.returnJsonArray(payloads);
		return {
			workflowData: [executionData],
		};
	}
}
