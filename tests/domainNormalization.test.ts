import { strict as assert } from 'node:assert';
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { leadspickerApiRequest } from '../nodes/Leadspicker/GenericFunctions';

/**
 * The credential's Domain field drives every request, not just the credential test,
 * so a value a user can plausibly type must not produce an unusable URL.
 */
function contextWithDomain(domain: unknown, seen: string[]) {
	return {
		getNode: () => ({ name: 'Leadspicker Test Node' }) as any,
		async getCredentials() {
			return { token: 'test-token', domain };
		},
		helpers: {
			async httpRequestWithAuthentication(_credentialType: string, options: IHttpRequestOptions) {
				seen.push(options.url);
				return { body: [], headers: {} };
			},
		},
	} as unknown as IExecuteFunctions;
}

async function urlFor(domain: unknown) {
	const seen: string[] = [];
	await leadspickerApiRequest.call(contextWithDomain(domain, seen), 'GET', '/lists/simple');
	return seen[0];
}

describe('Credential domain normalization', () => {
	const PROD = 'https://app.leadspicker.com/app/sb/api/lists/simple';

	it('keeps a well-formed origin as given', async () => {
		assert.equal(await urlFor('https://app.leadspicker.com'), PROD);
		assert.equal(await urlFor('http://localhost:8000'), 'http://localhost:8000/app/sb/api/lists/simple');
	});

	it('falls back to production when the field is empty or missing', async () => {
		assert.equal(await urlFor(''), PROD);
		assert.equal(await urlFor('   '), PROD);
		assert.equal(await urlFor(undefined), PROD);
	});

	it('trims whitespace and trailing slashes', async () => {
		assert.equal(await urlFor('  https://app.leadspicker.com///  '), PROD);
	});

	it('adds a scheme to a bare host, which would otherwise be a relative URL', async () => {
		assert.equal(await urlFor('app.leadspicker.com'), PROD);
	});

	it('drops a pasted API prefix rather than doubling it', async () => {
		assert.equal(await urlFor('https://app.leadspicker.com/app/sb/api'), PROD);
		assert.equal(await urlFor('app.leadspicker.com/app/sb/api/'), PROD);
	});
});
