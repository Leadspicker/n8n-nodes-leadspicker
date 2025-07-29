import type {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';

export async function leadspickerApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
) {
	const options: IRequestOptions = {
		headers: {},
		method,
		// TODO don't forget to change this to PRODUCTION URL
		//url: `https://app.leadspicker.com/app/sb/api${endpoint}`,
		url: `http://localhost:8000/app/sb/api${endpoint}`,
		body,
		json: true,
		qs: query,
	};

	return await this.helpers.requestWithAuthentication.call(this, 'leadspickerApi', options);
}

// Helper function to get user's timezone with fallback
export function getUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
	} catch {
		return 'Europe/Prague';
	}
}
