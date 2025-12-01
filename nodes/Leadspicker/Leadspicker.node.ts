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

import { leadspickerApiRequest, isPlainObject } from './GenericFunctions';
import {
	accountFields,
	accountOperations,
	campaignFields,
	campaignOperations,
	leadFields,
	leadFinderFields,
	leadFinderInputFields,
	leadOperations,
	linkedinActivityFields,
	linkedinActivityOperations,
	outreachOperations,
	globalExclusionListFields,
	globalExclusionListOperations,
	replyFields,
	replyOperations,
	MANUAL_ID_OPTION,
} from './descriptions';

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

const DEFAULT_PAGE_SIZE = 1000;

export class Leadspicker implements INodeType {
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
		const id = Leadspicker.toNumericId(value);
		if (id === undefined) {
			throw new NodeOperationError(context.getNode(), `Please select a valid ${fieldName}.`);
		}
		return id;
	}

	private static toNumberOrNull(value: unknown): number | null {
		const numeric = Leadspicker.toNumericId(value as NodeParameterValueType);
		return numeric ?? null;
	}

	private static coerceToDataObject(value: unknown): IDataObject {
		return isPlainObject(value) ? (value as IDataObject) : ({ raw: value } as IDataObject);
	}

	private static async fetchCurrentUser(context: IExecuteFunctions): Promise<IDataObject> {
		const response = await leadspickerApiRequest.call(context, 'GET', '/auth/me');
		return Leadspicker.coerceToDataObject(response);
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
			return Leadspicker.getIdOrThrow(context, manualValue, fieldName);
		}
		return Leadspicker.getIdOrThrow(context, selection, fieldName);
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
			return Leadspicker.toNumericId(params[manualName]);
		}
		return Leadspicker.toNumericId(selection);
	}

	private static getCampaignIdForLeadOptions(context: ILoadOptionsFunctions): number | undefined {
		const params = (context.getCurrentNodeParameters?.() ?? {}) as IDataObject;
		return (
			Leadspicker.tryGetIdFromParameters(params, 'projectLogId', 'projectLogIdManual') ??
			Leadspicker.tryGetIdFromParameters(
				params,
				'personLookupProjectId',
				'personLookupProjectIdManual',
			) ??
			Leadspicker.tryGetIdFromParameters(params, 'projectId', 'projectIdManual')
		);
	}

	private static toDataObjectArray(value: unknown): IDataObject[] {
		const normalize = (arr: unknown[]): IDataObject[] =>
			arr.filter((entry): entry is IDataObject => isPlainObject(entry));
		if (Array.isArray(value)) {
			return normalize(value);
		}
		if (isPlainObject(value)) {
			const candidateKeys = ['items', 'results', 'data'];
			for (const key of candidateKeys) {
				const possibleArray = (value as IDataObject)[key];
				if (Array.isArray(possibleArray)) {
					return normalize(possibleArray);
				}
			}
		}
		return [];
	}

	private static countRunningRobots(payload: unknown): number {
		const robots = Leadspicker.toDataObjectArray(payload);
		return robots.reduce((count, robot) => {
			const status = typeof robot.status === 'string' ? robot.status.toLowerCase().trim() : '';
			return status === 'running' ? count + 1 : count;
		}, 0);
	}

	private static isAttributeValueObject(value: unknown): value is { value: unknown } {
		if (!isPlainObject(value)) return false;
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
			return data.map((entry) => Leadspicker.flattenLeadPayload(entry));
		}
		if (!isPlainObject(data)) {
			return data;
		}

		if (Leadspicker.isAttributeValueObject(data)) {
			return Leadspicker.flattenLeadPayload(data.value);
		}

		const clone: IDataObject = { ...data };
		const contactData = clone.contact_data as IDataObject | undefined;
		if (isPlainObject(contactData)) {
			for (const [key, value] of Object.entries(contactData)) {
				if (!Leadspicker.hasMeaningfulValue(clone[key])) {
					clone[key] = value;
				}
			}
			delete clone.contact_data;
		}
		const personData = clone.person_data as IDataObject | undefined;
		if (isPlainObject(personData)) {
			for (const [key, value] of Object.entries(personData)) {
				if (!Leadspicker.hasMeaningfulValue(clone[key])) {
					clone[key] = value;
				}
			}
			delete clone.person_data;
		}

		for (const [key, value] of Object.entries(clone)) {
			if (Array.isArray(value) || isPlainObject(value)) {
				const normalizedValue = Leadspicker.flattenLeadPayload(value) as
					| GenericValue
					| IDataObject
					| GenericValue[]
					| IDataObject[];
				clone[key] = normalizedValue;
			}
		}

		return clone;
	}

	private static splitIdentifierString(value: unknown): string[] {
		if (typeof value !== 'string' || value.trim() === '') {
			return [];
		}
		return value
			.split(/\r?\n/)
			.map((entry) => entry.trim())
			.filter((entry) => entry !== '');
	}

	private static categorizeBlacklistEntries(entries: string[]) {
		const buckets = {
			emails: [] as string[],
			linkedins: [] as string[],
			company_linkedins: [] as string[],
			domains: [] as string[],
		};
		for (const entry of entries) {
			const normalized = entry.toLowerCase();
			if (entry.includes('@')) {
				buckets.emails.push(entry);
				continue;
			}
			if (
				normalized.includes('linkedin.com/company') ||
				normalized.includes('linkedin.com/school')
			) {
				buckets.company_linkedins.push(entry);
				continue;
			}
			if (normalized.includes('linkedin.com/')) {
				buckets.linkedins.push(entry);
				continue;
			}
			buckets.domains.push(entry);
		}
		return buckets;
	}

	private static extractItemsFromFinderResponse(
		response: unknown,
		key_name: string,
	): IDataObject[] {
		if (!isPlainObject(response)) return [];

		const items: IDataObject[] = [];
		if (Array.isArray(response[key_name])) {
			items.push(...(response[key_name] as IDataObject[]));
		}
		return items;
	}

	private static buildLeadPayload(context: IExecuteFunctions, i: number): IDataObject {
		const customFields = context.getNodeParameter('customFields', i) as IDataObject;
		const fieldMappings: Array<[string, string]> = [
			['leadCountry', 'country'],
			['leadEmail', 'email'],
			['leadFirstName', 'first_name'],
			['leadLastName', 'last_name'],
			['leadPosition', 'position'],
			['leadCompanyName', 'company_name'],
			['leadCompanyWebsite', 'company_website'],
			['leadCompanyLinkedin', 'company_linkedin'],
			['leadLinkedin', 'linkedin'],
			['leadSalesNavigator', 'salesnav'],
		];
		const body: IDataObject = { data_source: 'user_provided' };
		for (const [paramName, payloadKey] of fieldMappings) {
			body[payloadKey] = context.getNodeParameter(paramName, i) as NodeParameterValueType;
		}
		const fullNameRaw = context.getNodeParameter('leadFullName', i) as string;
		if (typeof fullNameRaw === 'string') {
			const nameParts = fullNameRaw
				.split(/\s+/)
				.map((part) => part.trim())
				.filter((part) => part.length > 0);
			if (nameParts.length >= 2) {
				// Use first token as first name, join remaining parts for last name
				body.first_name = nameParts[0];
				body.last_name = nameParts.slice(1).join(' ');
			}
		}

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

		return body;
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
					const id = Leadspicker.toNumericId(campaign?.id as NodeParameterValueType);
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
				const projectId = Leadspicker.getCampaignIdForLeadOptions(this);
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
					const id = Leadspicker.toNumericId(lead?.id as NodeParameterValueType);
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
		displayName: 'Leadspicker',
		name: 'leadspicker',
		icon: 'file:logo_leadspicker.svg',
		group: ['transform'],
		version: 1,
		subtitle:
			'={{( { person: "Lead", project: "Campaign", reply: "Reply", linkedinActivity: "Linkedin", globalExclusionList: "Global Exclusion List", outreach: "Outreach", account: "Account" }[$parameter["resource"]] ?? $parameter["resource"]) + ": " + $parameter["operation"]}}',
		description: 'Interact with Leadspicker API',
		defaults: {
			name: 'Leadspicker',
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
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Campaign',
						value: 'project',
					},
					{
						name: 'Global Exclusion List',
						value: 'globalExclusionList',
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
						name: 'Outreach',
						value: 'outreach',
					},
					{
						name: 'Reply',
						value: 'reply',
					},
				],
				default: 'project',
			},
			...accountOperations,
			...leadOperations,
			...campaignOperations,
			...replyOperations,
			...linkedinActivityOperations,
			...globalExclusionListOperations,
			...outreachOperations,
			...accountFields,
			...campaignFields,
			...globalExclusionListFields,
			...leadFields,
			...replyFields,
			...leadFinderInputFields,
			...linkedinActivityFields,
			...leadFinderFields,
		],
	};

	/**
	 * Handles operations for the 'Account' resource.
	 */
	private static async handleAccountOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'getInfo': {
				const user = await Leadspicker.fetchCurrentUser(context);

				const userConfig = isPlainObject(user.config) ? (user.config as IDataObject) : undefined;
				const subscription = isPlainObject(user.subscription)
					? (user.subscription as IDataObject)
					: undefined;
				const allowedRobotsCount = Leadspicker.toNumberOrNull(userConfig?.n_allowed_robots) ?? 0;
				const createdRobotsCount = Leadspicker.toNumberOrNull(user.created_robots_count) ?? 0;
				const allowedEmailAccounts =
					Leadspicker.toNumberOrNull(userConfig?.n_allowed_email_accounts) ?? 0;
				const allowedLinkedinAccounts =
					Leadspicker.toNumberOrNull(userConfig?.n_allowed_linkedin_accounts) ?? 0;

				const robotsResponse = await leadspickerApiRequest.call(context, 'GET', '/robots');
				const runningRobotsCount = Leadspicker.countRunningRobots(robotsResponse);
				const subscriptionEnd =
					typeof subscription?.current_period_end === 'string'
						? subscription.current_period_end
						: typeof subscription?.current_period_end === 'number'
							? subscription.current_period_end
							: null;

				return [
					{
						id: user.id ?? null,
						first_name: typeof user.first_name === 'string' ? user.first_name : null,
						last_name: typeof user.last_name === 'string' ? user.last_name : null,
						email: typeof user.email === 'string' ? user.email : null,
						available_robot_results_this_period:
							Leadspicker.toNumberOrNull(user.available_robot_results_this_period) ?? 0,
						credits_available_now:
							Leadspicker.toNumberOrNull(subscription?.credits_available_now) ?? 0,
						available_robots: Math.max(allowedRobotsCount - createdRobotsCount, 0),
						created_robots_count: createdRobotsCount,
						allowed_email_accounts: allowedEmailAccounts,
						allowed_linkedin_accounts: allowedLinkedinAccounts,
						running_robots_count: runningRobotsCount,
						subscription_end_date: subscriptionEnd,
					},
				];
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Account resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Lead' resource.
	 */
	private static async handleLeadOperations(context: IExecuteFunctions, i: number): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'list': {
				const campaignId = Leadspicker.getIdFromOptionOrManual(
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

				return Leadspicker.flattenLeadPayload(persons);
			}
			case 'create':
			case 'update': {
				const body = Leadspicker.buildLeadPayload(context, i);

				if (operation === 'create') {
					body.project_id = Leadspicker.getIdFromOptionOrManual(
						context,
						'projectId',
						'projectIdManual',
						'project',
						i,
					);
					const response = await leadspickerApiRequest.call(context, 'POST', '/persons', body);
					return Leadspicker.flattenLeadPayload(response);
				} else {
					const leadId = Leadspicker.getIdFromOptionOrManual(
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
					return Leadspicker.flattenLeadPayload(response);
				}
			}
			case 'byCompanyLinkedin':
			case 'byCompanyName': {
				return Leadspicker.handleLeadFinderOperations(context, i);
			}
			case 'get': {
				const leadId = Leadspicker.getIdFromOptionOrManual(
					context,
					'personId',
					'personIdManual',
					'person',
					i,
				);
				const response = await leadspickerApiRequest.call(context, 'GET', `/persons/${leadId}`);
				return Leadspicker.flattenLeadPayload(response);
			}
			case 'delete': {
				const leadId = Leadspicker.getIdFromOptionOrManual(
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
				const campaignId = Leadspicker.getIdFromOptionOrManual(
					context,
					'projectDeleteId',
					'projectDeleteIdManual',
					'project',
					i,
				);
				return leadspickerApiRequest.call(context, 'DELETE', `/projects/${campaignId}`);
			}
			case 'addToExclusionList': {
				const campaignId = Leadspicker.getIdFromOptionOrManual(
					context,
					'projectBlacklistId',
					'projectBlacklistIdManual',
					'project',
					i,
				);
				const blacklistEntry = context.getNodeParameter('blacklistEntry', i) as string;
				const trimmedEntry = typeof blacklistEntry === 'string' ? blacklistEntry.trim() : '';
				if (!trimmedEntry) {
					throw new NodeOperationError(
						context.getNode(),
						'Please provide a LinkedIn URL, email, domain, or company profile to blacklist.',
					);
				}
				const body: IDataObject = { data: trimmedEntry };
				const query: IDataObject = { append: true };
				return leadspickerApiRequest.call(
					context,
					'PUT',
					`/projects/${campaignId}/blacklist-text`,
					body,
					query,
				);
			}
			case 'removeFromExclusionList': {
				const campaignId = Leadspicker.getIdFromOptionOrManual(
					context,
					'projectBlacklistId',
					'projectBlacklistIdManual',
					'project',
					i,
				);
				const blacklistEntry = context.getNodeParameter('blacklistEntry', i) as string;
				const trimmedEntry = typeof blacklistEntry === 'string' ? blacklistEntry.trim() : '';
				if (!trimmedEntry) {
					throw new NodeOperationError(
						context.getNode(),
						'Please provide a LinkedIn URL, email, domain, or company profile to remove from the blacklist.',
					);
				}
				const query: IDataObject = { identifier: trimmedEntry };
				return leadspickerApiRequest.call(
					context,
					'DELETE',
					`/projects/${campaignId}/blacklist-text`,
					{},
					query,
				);
			}
			case 'getExclusionList': {
				const campaignId = Leadspicker.getIdFromOptionOrManual(
					context,
					'projectBlacklistId',
					'projectBlacklistIdManual',
					'project',
					i,
				);
				try {
					return await leadspickerApiRequest.call(
						context,
						'GET',
						`/projects/${campaignId}/blacklist-text`,
					);
				} catch (error) {
					const httpCode =
						typeof error === 'object' && error !== null && 'httpCode' in error
							? (error as { httpCode?: string | number }).httpCode
							: undefined;
					if (
						(typeof httpCode === 'string' && httpCode === '404') ||
						(typeof httpCode === 'number' && httpCode === 404)
					) {
						return [
							{
								matched_emails_count: 0,
								updated: null,
								linkedins: [],
								company_linkedins: [],
								emails: [],
								domains: [],
							},
						];
					}
					throw error;
				}
			}
			case 'getCampaignLog': {
				const campaignId = Leadspicker.getIdFromOptionOrManual(
					context,
					'projectLogId',
					'projectLogIdManual',
					'project',
					i,
				);
				const search = context.getNodeParameter('projectLogSearch', i, '') as string;
				const startDate = context.getNodeParameter('projectLogStartDate', i, '') as string;
				const endDate = context.getNodeParameter('projectLogEndDate', i, '') as string;
				const personSelection = context.getNodeParameter(
					'projectLogPersonId',
					i,
					'',
				) as NodeParameterValueType;
				let personId: number | undefined;
				if (personSelection === MANUAL_ID_OPTION) {
					const manualValue = context.getNodeParameter('projectLogPersonIdManual', i);
					personId = Leadspicker.toNumericId(manualValue);
				} else {
					personId = Leadspicker.toNumericId(personSelection);
				}
				const eventTypes = context.getNodeParameter('projectLogEventTypes', i, []) as string[];
				const outreachStepTypes = context.getNodeParameter(
					'projectLogOutreachStepTypes',
					i,
					[],
				) as string[];
				const queryParts: string[] = [`page=1`, `page_size=${DEFAULT_PAGE_SIZE}`];
				const addParam = (key: string, value: string | number) => {
					queryParts.push(`${key}=${encodeURIComponent(value.toString())}`);
				};
				if (typeof search === 'string' && search.trim() !== '') {
					addParam('search', search.trim());
				}
				if (typeof startDate === 'string' && startDate.trim() !== '') {
					addParam('start_date', startDate.trim());
				}
				if (typeof endDate === 'string' && endDate.trim() !== '') {
					addParam('end_date', endDate.trim());
				}
				if (personId !== undefined) {
					addParam('person_id', personId);
				}
				if (Array.isArray(eventTypes)) {
					for (const type of eventTypes) {
						if (typeof type === 'string' && type.trim() !== '') {
							addParam('event_types', type);
						}
					}
				}
				if (Array.isArray(outreachStepTypes)) {
					for (const type of outreachStepTypes) {
						if (typeof type === 'string') {
							addParam('outreach_step_types', type);
						}
					}
				}
				let path = `/projects/${campaignId}/events`;
				if (queryParts.length > 0) {
					path += `?${queryParts.join('&')}`;
				}
				const response = (await leadspickerApiRequest.call(
					context,
					'GET',
					path,
					{},
					{},
				)) as IDataObject;
				if (Array.isArray(response?.results)) {
					return response.results as IDataObject[];
				}
				if (Array.isArray(response?.items)) {
					return response.items as IDataObject[];
				}
				if (Array.isArray(response)) {
					return response as IDataObject[];
				}
				return [];
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
							return Leadspicker.toNumericId(item.idManual);
						}
						return Leadspicker.toNumericId(item.id);
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
				return Leadspicker.extractItemsFromFinderResponse(response, 'persons');
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
				return Leadspicker.extractItemsFromFinderResponse(response, 'persons');
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
				const response = await leadspickerApiRequest.call(
					context,
					'POST',
					'/utils/linkedin-posts',
					body,
				);
				return Leadspicker.extractItemsFromFinderResponse(response, 'posts');
			}
			case 'getActivities': {
				const linkedinUrl = context.getNodeParameter('linkedinUrl', i) as string;
				const body: IDataObject = { linkedin_url: linkedinUrl };
				const response = await leadspickerApiRequest.call(
					context,
					'POST',
					'/utils/linkedin-activities',
					body,
				);
				return Leadspicker.extractItemsFromFinderResponse(response, 'activities');
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
				const includeSearchLikers = context.getNodeParameter(
					'includeSearchLikers',
					i,
					false,
				) as boolean;
				const includeSearchCommenters = context.getNodeParameter(
					'includeSearchCommenters',
					i,
					false,
				) as boolean;
				const options = context.getNodeParameter('reactorsSearchOptions', i, {}) as IDataObject;

				const commentersPerPost = includeSearchCommenters
					? 10
					: ((options.commentersPerPost as number) ?? 0);
				const likersPerPost = includeSearchLikers ? 10 : ((options.likersPerPost as number) ?? 0);

				const baseBody: IDataObject = {
					search_url: searchUrl,
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
				const includePostLikers = context.getNodeParameter(
					'includePostLikers',
					i,
					false,
				) as boolean;
				const includePostCommenters = context.getNodeParameter(
					'includePostCommenters',
					i,
					false,
				) as boolean;
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
	 * Handles operations for the 'Outreach' resource.
	 */
	private static async handleOutreachOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'getLinkedinAccounts':
				return leadspickerApiRequest.call(context, 'GET', '/linkedin-accounts');
			case 'getEmailAccounts':
				return leadspickerApiRequest.call(context, 'GET', '/email-accounts');
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Outreach resource.`,
				);
		}
	}

	/**
	 * Handles operations for the 'Global Exclusion List' resource.
	 */
	private static async handleGlobalExclusionListOperations(
		context: IExecuteFunctions,
		i: number,
	): Promise<any> {
		const operation = context.getNodeParameter('operation', i) as string;

		switch (operation) {
			case 'addLead': {
				const blacklistEntry = context.getNodeParameter('globalBlacklistEntry', i) as string;
				const trimmedEntry = typeof blacklistEntry === 'string' ? blacklistEntry.trim() : '';
				if (!trimmedEntry) {
					throw new NodeOperationError(
						context.getNode(),
						'Please provide a LinkedIn URL, email, domain, or company profile to add to the global exclusion list.',
					);
				}
				const body: IDataObject = { data: [trimmedEntry] };
				await leadspickerApiRequest.call(context, 'POST', '/global-blacklist-add', body);
				return [];
			}
			case 'removeLead': {
				const blacklistEntry = context.getNodeParameter('globalBlacklistEntry', i) as string;
				const trimmedEntry = typeof blacklistEntry === 'string' ? blacklistEntry.trim() : '';
				if (!trimmedEntry) {
					throw new NodeOperationError(
						context.getNode(),
						'Please provide a LinkedIn URL, email, domain, or company profile to remove from the global exclusion list.',
					);
				}
				const query: IDataObject = { identifier: trimmedEntry };
				await leadspickerApiRequest.call(context, 'DELETE', '/global-blacklist', {}, query);
				return [];
			}
			case 'get': {
				const filters = context.getNodeParameter(
					'globalExclusionListFilters',
					i,
					{},
				) as IDataObject;
				const query: IDataObject = {};
				const memberId = Leadspicker.toNumericId(filters.memberId as NodeParameterValueType);
				if (memberId !== undefined) {
					query.member_id = memberId;
				}
				const response = (await leadspickerApiRequest.call(
					context,
					'GET',
					'/global-blacklist',
					{},
					query,
				)) as IDataObject | IDataObject[];
				if (!isPlainObject(response) || typeof response.data !== 'string') {
					return response;
				}
				const entries = Leadspicker.splitIdentifierString(response.data);
				const buckets = Leadspicker.categorizeBlacklistEntries(entries);
				const unsubscribed = Leadspicker.splitIdentifierString(response.unsubscribed_emails);
				const matchedEmailsCount =
					typeof response.matched_emails_count === 'number'
						? response.matched_emails_count
						: buckets.emails.length;
				return [
					{
						linkedins: buckets.linkedins,
						company_linkedins: buckets.company_linkedins,
						emails: buckets.emails,
						domains: buckets.domains,
						unsubscribed_emails: unsubscribed,
						matched_emails_count: matchedEmailsCount,
						updated: response.updated ?? null,
					},
				];
			}
			default:
				throw new NodeOperationError(
					context.getNode(),
					`The operation "${operation}" is not supported for Global Exclusion List resource.`,
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
					case 'account':
						responseData = await Leadspicker.handleAccountOperations(this, i);
						break;
					case 'person':
						responseData = await Leadspicker.handleLeadOperations(this, i);
						break;
					case 'project':
						responseData = await Leadspicker.handleCampaignOperations(this, i);
						break;
					case 'reply':
						responseData = await Leadspicker.handleReplyOperations(this, i);
						break;
					case 'linkedinActivity':
						responseData = await Leadspicker.handleLinkedinActivityOperations(this, i);
						break;
					case 'globalExclusionList':
						responseData = await Leadspicker.handleGlobalExclusionListOperations(this, i);
						break;
					case 'outreach':
						responseData = await Leadspicker.handleOutreachOperations(this, i);
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
