import { sleep } from 'n8n-workflow';
import { version as packageVersion } from '../../package.json';
import type {
	IExecuteFunctions,
	IHookFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IWebhookFunctions,
} from 'n8n-workflow';

// Identifies plugin traffic to the Leadspicker API, so it can be told apart from raw
// API calls and so upgrade adoption of this package stays measurable server-side.
export const USER_AGENT = `n8n-nodes-leadspicker/${packageVersion}`;

const RATE_LIMIT_THRESHOLD = 10;
const THROTTLE_DELAY_MS = 1000;
const RETRY_DELAY_MS = 10_000;
const MAX_RETRIES = 6;

function toNumber(headerValue: string | string[] | undefined) {
	if (Array.isArray(headerValue)) {
		return toNumber(headerValue[0]);
	}
	const parsed = Number(headerValue);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function shouldThrottle(headers: Record<string, string | string[] | undefined>) {
	const remainingMinute = toNumber(headers['x-ratelimit-remaining-minute']);
	const remainingDay = toNumber(headers['x-ratelimit-remaining-day']);
	const throttle =
		(remainingMinute !== undefined && remainingMinute < RATE_LIMIT_THRESHOLD) ||
		(remainingDay !== undefined && remainingDay < RATE_LIMIT_THRESHOLD);
	return throttle;
}

function getStatusCode(error: unknown) {
	if (typeof error === 'object' && error !== null && 'httpCode' in error) {
		const { httpCode } = error as { httpCode?: unknown };
		if (typeof httpCode === 'string') {
			return httpCode;
		}
	}
	return undefined;
}

export async function leadspickerApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
) {
	const options: IHttpRequestOptions = {
		headers: { 'User-Agent': USER_AGENT },
		method,
		url: `https://app.leadspicker.com/app/sb/api${endpoint}`,
		//url: `http://localhost:8000/app/sb/api${endpoint}`,
		//url: `http://host.docker.internal:8000/app/sb/api${endpoint}`,
		body,
		json: true,
		qs: query,
		returnFullResponse: true,
	};

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'leadspickerApi',
				options,
			);
			if (
				shouldThrottle((response.headers ?? {}) as Record<string, string | string[] | undefined>)
			) {
				await sleep(THROTTLE_DELAY_MS);
			}

			return response.body;
		} catch (error) {
			const statusCode = getStatusCode(error);
			if (statusCode === '429' && attempt < MAX_RETRIES - 1) {
				await sleep(RETRY_DELAY_MS);
				continue;
			}
			throw error;
		}
	}

	throw new Error('Exceeded retry attempts after repeated rate limit responses.');
}

// Helper function to get user's timezone with fallback
export function getUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
	} catch {
		return 'Europe/Prague';
	}
}

export function isPlainObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Project kinds
//
// The backend split the single `/projects` namespace into two: `/lists` hold
// contacts, enrichment and AI columns, `/sequences` hold outreach steps and are fed
// by a connected list. Every `/projects` route is deprecated with a 2026-09-13
// sunset, so nothing in this package calls one any more.
//
// Project-scoped operations live under `/lists/{id}/...` and `/sequences/{id}/...`.
// An operation that belongs to one kind has exactly one valid prefix. The groups both
// kinds share — detail, delete, timeline events — are the same handler under either
// prefix: the backend resolves the project by id and never checks it against the
// prefix, so an id whose kind we do not know is harmless there. Those use
// `/sequences`, the kind the backend itself defaults to and the same fallback the
// Leadspicker app makes in `resolveProjectUrlKind`.
// ---------------------------------------------------------------------------

/** Listing that backs a list picker: id and name only, newest first. */
export const LISTS_SIMPLE_ENDPOINT = '/lists/simple';
/** Listing that backs a sequence picker. Same shape as `LISTS_SIMPLE_ENDPOINT`. */
export const SEQUENCES_SIMPLE_ENDPOINT = '/sequences/simple';
/** Both kinds, for pickers that accept either. There is no all-kinds endpoint left. */
export const ALL_PROJECTS_ENDPOINTS = [LISTS_SIMPLE_ENDPOINT, SEQUENCES_SIMPLE_ENDPOINT];

const PROJECT_OPTIONS_LIMIT = 50;

const PROJECT_KIND_LABEL: Record<string, string> = { list: 'List', sequence: 'Sequence' };

export function toNumericId(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function asArray(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		return response as IDataObject[];
	}
	if (isPlainObject(response) && Array.isArray(response.results)) {
		return response.results as IDataObject[];
	}
	return [];
}

/**
 * Loads project dropdown options from one or more simple listings.
 *
 * Passing both listings is how a picker offers every kind, since `/projects` — the
 * only endpoint that ever returned both — is deprecated. Each listing is newest-first
 * on its own, so a merged result is re-sorted on `created` to keep that order across
 * kinds, and the kind is shown in the label so two same-named projects stay apart.
 * The option value is the bare id either way, so no saved workflow changes meaning.
 */
export async function loadProjectOptions(
	context: ILoadOptionsFunctions,
	endpoints: string[],
): Promise<INodePropertyOptions[]> {
	const query: IDataObject = { limit: PROJECT_OPTIONS_LIMIT };
	const responses = await Promise.all(
		endpoints.map(async (endpoint) =>
			asArray(await leadspickerApiRequest.call(context, 'GET', endpoint, {}, query)),
		),
	);
	const projects = responses.flat();
	const showKind = endpoints.length > 1;

	if (showKind) {
		// `created` is an ISO-8601 string, so a plain string compare is already
		// chronological. Missing values sort last rather than throwing off the order.
		projects.sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? '')));
		// Each listing was capped at the limit on its own, so the merge holds twice as
		// many. Trim back so the picker still offers the newest `limit` overall.
		projects.length = Math.min(projects.length, PROJECT_OPTIONS_LIMIT);
	}

	const options: INodePropertyOptions[] = [];
	const seen = new Set<number>();
	for (const project of projects) {
		const id = toNumericId(project?.id);
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		const kind = PROJECT_KIND_LABEL[String(project?.type)];
		const rawName = typeof project?.name === 'string' ? project.name.trim() : '';
		// An unnamed project is labelled by its kind and id, which already tells it
		// apart, so it takes no kind suffix on top.
		const name =
			rawName !== ''
				? `${rawName}${showKind && kind ? ` (${kind})` : ''}`
				: `${kind ?? 'Project'} #${id}`;
		options.push({ name, value: id.toString() });
	}
	return options;
}
