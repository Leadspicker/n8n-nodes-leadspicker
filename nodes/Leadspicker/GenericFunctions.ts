import { sleep } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	IHookFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

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
		headers: {},
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
