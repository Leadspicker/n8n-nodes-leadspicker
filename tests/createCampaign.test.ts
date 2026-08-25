import { strict as assert } from 'node:assert';
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { Leadspicker } from '../nodes/Leadspicker/Leadspicker.node';
import { USER_AGENT } from '../nodes/Leadspicker/GenericFunctions';
import { version as packageVersion } from '../package.json';

type ParamMap = Record<string, unknown>;

interface RecordedRequest {
	credentialType: string;
	options: IHttpRequestOptions;
}

function createTestContext(params: ParamMap, requests: RecordedRequest[]): IExecuteFunctions {
	return {
		getNodeParameter(name: string) {
			if (!(name in params)) {
				throw new Error(`Parameter "${name}" was not provided in test setup.`);
			}
			return params[name];
		},
		async getCredentials() {
			return { token: 'test-token', domain: 'https://app.leadspicker.com' };
		},
		getNode() {
			return { name: 'Leadspicker Test Node' } as any;
		},
		helpers: {
			async httpRequestWithAuthentication(credentialType: string, options: IHttpRequestOptions) {
				requests.push({ credentialType, options });
				return { body: { id: 42 }, headers: {} };
			},
		},
	} as unknown as IExecuteFunctions;
}

describe('Leadspicker campaign create', () => {
	it('creates the project through the lists endpoint without a type field', async () => {
		const requests: RecordedRequest[] = [];
		const context = createTestContext(
			{ operation: 'create', projectName: 'DACH founders', projectTimezone: 'Europe/Prague' },
			requests,
		);

		const result = await (Leadspicker as any).handleCampaignOperations(context, 0);

		assert.deepEqual(result, { id: 42 });
		assert.equal(requests.length, 1);
		const [{ options }] = requests;
		assert.equal(options.method, 'POST');
		// The path, not the host: the base URL is switched to a local backend during
		// manual testing, and the endpoint is what this test is about.
		assert.equal(new URL(options.url).pathname, '/app/sb/api/lists');
		assert.deepEqual(options.body, { name: 'DACH founders', timezone: 'Europe/Prague' });
		assert.ok(!('type' in (options.body as Record<string, unknown>)));
	});

	it('identifies the plugin with a versioned User-Agent header', async () => {
		const requests: RecordedRequest[] = [];
		const context = createTestContext(
			{ operation: 'create', projectName: 'DACH founders', projectTimezone: 'Europe/Prague' },
			requests,
		);

		await (Leadspicker as any).handleCampaignOperations(context, 0);

		const headers = requests[0].options.headers as Record<string, string>;
		assert.equal(headers['User-Agent'], `n8n-nodes-leadspicker/${packageVersion}`);
		assert.equal(headers['User-Agent'], USER_AGENT);
	});
});
