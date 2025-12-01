import type {
	IExecuteFunctions,
	IHookFunctions,
	IDataObject,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
	IWebhookFunctions,
} from 'n8n-workflow';

const RATE_LIMIT_THRESHOLD = 10;
const THROTTLE_DELAY_MS = 1000;
const RETRY_DELAY_MS = 10_000;
const MAX_RETRIES = 6;

type ConsoleLogger = {
	log: (...args: unknown[]) => void;
};

export function logToConsole(message: string, payload: Record<string, unknown>) {
	const consoleLogger = (globalThis as { console?: ConsoleLogger }).console;
	if (!consoleLogger) {
		return;
	}
	consoleLogger.log(message, payload);
}

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
	logToConsole('Leadspicker rate limit check', {
		remainingMinute,
		remainingDay,
		threshold: RATE_LIMIT_THRESHOLD,
	});
	const throttle =
		(remainingMinute !== undefined && remainingMinute < RATE_LIMIT_THRESHOLD) ||
		(remainingDay !== undefined && remainingDay < RATE_LIMIT_THRESHOLD);
	if (throttle) {
		logToConsole('Leadspicker rate limit threshold reached', {
			remainingMinute,
			remainingDay,
			threshold: RATE_LIMIT_THRESHOLD,
		});
	}
	return throttle;
}

type TimerSetTimeout = (callback: () => void, ms?: number) => unknown;

function sleep(ms: number) {
	return new Promise<void>((resolve) => {
		const timeout = (globalThis as { setTimeout?: TimerSetTimeout }).setTimeout;
		if (timeout) {
			timeout(resolve, ms);
			return;
		}
		throw new Error('setTimeout is unavailable in this environment.');
	});
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
	const options: IRequestOptions = {
		headers: {},
		method,
		url: `https://app.leadspicker.com/app/sb/api${endpoint}`,
		//url: `http://localhost:8000/app/sb/api${endpoint}`,
		//url: `http://host.docker.internal:8000/app/sb/api${endpoint}`,
		body,
		json: true,
		qs: query,
		resolveWithFullResponse: true,
	};

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			// logToConsole('Leadspicker API request call', { method, endpoint });
			const response = await this.helpers.requestWithAuthentication.call(
				this,
				'leadspickerApi',
				options,
			);
			const statusCode = typeof response.statusCode === 'number' ? response.statusCode : undefined;
			logToConsole('Leadspicker API request completed', {
				attempt: attempt + 1,
				status: statusCode,
			});
			if (
				shouldThrottle((response.headers ?? {}) as Record<string, string | string[] | undefined>)
			) {
				logToConsole('Leadspicker throttling request to respect rate limits', {
					attempt: attempt + 1,
					delayMs: THROTTLE_DELAY_MS,
					status: statusCode,
				});
				await sleep(THROTTLE_DELAY_MS);
			}

			return response.body;
		} catch (error) {
			const statusCode = getStatusCode(error);
			if (statusCode === '429' && attempt < MAX_RETRIES - 1) {
				logToConsole('Leadspicker retry scheduled after rate limit response', {
					attempt: attempt + 1,
					delayMs: RETRY_DELAY_MS,
					status: statusCode,
				});
				await sleep(RETRY_DELAY_MS);
				continue;
			}
			logToConsole('Leadspicker API request failed without retry', {
				attempt: attempt + 1,
				status: statusCode,
			});
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
