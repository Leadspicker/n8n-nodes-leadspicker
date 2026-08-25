import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { Leadspicker } from '../nodes/Leadspicker/Leadspicker.node';
import { LeadspickerTrigger } from '../nodes/Leadspicker/LeadspickerTrigger.node';

type ParamMap = Record<string, unknown>;

interface RecordedRequest {
	method: string;
	url: string;
	body: unknown;
	qs: unknown;
}

/** Context that records requests and answers each one from `responder`. */
function createContext(
	params: ParamMap,
	requests: RecordedRequest[],
	responder: (url: string) => unknown = () => ({}),
) {
	return {
		getNodeParameter(name: string, _i?: number, fallback?: unknown) {
			if (!(name in params)) {
				if (fallback !== undefined) return fallback;
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
			async httpRequestWithAuthentication(_credentialType: string, options: IHttpRequestOptions) {
				requests.push({
					method: options.method as string,
					url: options.url,
					body: options.body,
					qs: options.qs,
				});
				return { body: responder(options.url), headers: {} };
			},
		},
	} as unknown as IExecuteFunctions & ILoadOptionsFunctions;
}

// The host is deliberately not asserted: it is switched to a local backend during
// manual testing, and the endpoint each operation addresses is what these tests are
// about. `path()` compares the API-relative path so the suite survives that swap.
const API_PREFIX = '/app/sb/api';

function path(url: string) {
	const { pathname } = new URL(url);
	assert.ok(pathname.startsWith(API_PREFIX), `unexpected API prefix: ${pathname}`);
	return pathname.slice(API_PREFIX.length);
}

describe('Project kind endpoints', () => {
	describe('campaign operations address a kind prefix, never /projects', () => {
		it('deletes a sequence through the sequence prefix', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{ operation: 'delete', projectDeleteId: '42' },
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'DELETE');
			// The value stayed `delete` precisely so this request is byte-identical to
			// the one a workflow saved before the split already sends.
			assert.equal(path(requests[0].url), '/sequences/42');
		});

		it('deletes a list through the list prefix', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{ operation: 'deleteList', listDeleteId: '7' },
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'DELETE');
			// Splitting the operation by kind is what lets this address /lists at all —
			// the merged operation had to fall back to /sequences for an unknown kind.
			assert.equal(path(requests[0].url), '/lists/7');
		});

		it('writes the exclusion list on the sequence prefix, its only valid one', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{
					operation: 'addToExclusionList',
					projectBlacklistId: '7',
					blacklistEntry: 'spam@example.com',
				},
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'PUT');
			assert.equal(path(requests[0].url), '/sequences/7/blacklist-text');
			assert.deepEqual(requests[0].body, { data: 'spam@example.com' });
		});

		it('removes an exclusion list entry on the sequence prefix', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{
					operation: 'removeFromExclusionList',
					projectBlacklistId: '7',
					blacklistEntry: 'spam@example.com',
				},
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests[0].method, 'DELETE');
			assert.equal(path(requests[0].url), '/sequences/7/blacklist-text');
		});

		it('reads timeline events on the sequence prefix, which serves either kind', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{ operation: 'getCampaignLog', projectLogId: '9' },
				requests,
				() => ({ results: [] }),
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests.length, 1);
			assert.equal(path(requests[0].url), '/sequences/9/events');
			assert.ok(requests[0].url.includes('?'), 'expected a query string on the events call');
		});
	});

	describe('the listing operations address the kind route and cannot paginate', () => {
		const base = { returnAll: false, limit: 50, simplify: true, projectSearchQuery: '' };

		it('lists and sequences each read their own simple listing', async () => {
			for (const [operation, expected] of [
				['getLists', '/lists/simple'],
				['getSequences', '/sequences/simple'],
			] as const) {
				const requests: RecordedRequest[] = [];
				const context = createContext({ ...base, operation }, requests);

				await (Leadspicker as any).handleCampaignOperations(context, 0);

				assert.equal(requests.length, 1);
				assert.equal(requests[0].method, 'GET');
				assert.equal(path(requests[0].url), expected);
			}
		});

		it('drops the simple projection for the rich listing', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{ ...base, operation: 'getSequences', simplify: false },
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(path(requests[0].url), '/sequences');
		});

		it('sends the limit only when not returning all', async () => {
			const capped: RecordedRequest[] = [];
			await (Leadspicker as any).handleCampaignOperations(
				createContext({ ...base, operation: 'getLists', limit: 5 }, capped),
				0,
			);
			assert.deepEqual(capped[0].qs, { limit: 5 });

			// The backend slices with `qs[:limit]` and ignores offset/page, so every
			// result is fetched by omitting the limit rather than by walking pages.
			const all: RecordedRequest[] = [];
			await (Leadspicker as any).handleCampaignOperations(
				createContext({ ...base, operation: 'getLists', returnAll: true }, all),
				0,
			);
			assert.equal(all.length, 1, 'return-all must not paginate');
			assert.deepEqual(all[0].qs, {});
		});

		it('forwards a trimmed search query and omits an empty one', async () => {
			const searched: RecordedRequest[] = [];
			await (Leadspicker as any).handleCampaignOperations(
				createContext({ ...base, operation: 'getLists', projectSearchQuery: '  acme  ' }, searched),
				0,
			);
			assert.deepEqual(searched[0].qs, { limit: 50, search_query: 'acme' });

			const blank: RecordedRequest[] = [];
			await (Leadspicker as any).handleCampaignOperations(
				createContext({ ...base, operation: 'getLists', projectSearchQuery: '   ' }, blank),
				0,
			);
			assert.deepEqual(blank[0].qs, { limit: 50 });
		});
	});

	describe('pickers are fed by the kind listings', () => {
		const lists = [
			{ id: 1, name: 'DACH founders', type: 'list', created: '2026-08-01T10:00:00Z' },
			{ id: 2, name: 'Nordics', type: 'list', created: '2026-08-03T10:00:00Z' },
		];
		const sequences = [
			{ id: 3, name: 'Q3 cold email', type: 'sequence', created: '2026-08-02T10:00:00Z' },
		];
		const responder = (url: string) => (url.includes('/lists/simple') ? lists : sequences);

		const loadOptions = (node: { methods?: any }) => node.methods.loadOptions;

		it('offers only lists where leads are created', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext({}, requests, responder);

			const options = await loadOptions(new Leadspicker()).getLists.call(context);

			assert.deepEqual(requests.map((r) => path(r.url)), ['/lists/simple']);
			// A single-kind picker needs no kind suffix — every entry is the same kind.
			assert.deepEqual(options, [
				{ name: 'DACH founders', value: '1' },
				{ name: 'Nordics', value: '2' },
			]);
		});

		it('merges both listings, newest first, for the all-kinds picker', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext({}, requests, responder);

			const options = await loadOptions(new Leadspicker()).getCampaigns.call(context);

			assert.deepEqual(requests.map((r) => path(r.url)).sort(), [
				'/lists/simple',
				'/sequences/simple',
			]);
			// Each listing is newest-first on its own; the merge restores that across kinds.
			assert.deepEqual(options, [
				{ name: 'Nordics (List)', value: '2' },
				{ name: 'Q3 cold email (Sequence)', value: '3' },
				{ name: 'DACH founders (List)', value: '1' },
			]);
		});

		it('offers only sequences where the operation is sequence work', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext({}, requests, responder);

			const options = await loadOptions(new Leadspicker()).getSequences.call(context);

			assert.deepEqual(requests.map((r) => path(r.url)), ['/sequences/simple']);
			assert.deepEqual(options, [{ name: 'Q3 cold email', value: '3' }]);
		});

		it('feeds the trigger event filter from both kinds too', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext({}, requests, responder);

			const options = await loadOptions(new LeadspickerTrigger()).getCampaigns.call(context);

			assert.deepEqual(requests.map((r) => path(r.url)).sort(), [
				'/lists/simple',
				'/sequences/simple',
			]);
			assert.equal(options.length, 3);
		});
	});

	// The `/projects` namespace is deprecated with a 2026-09-13 sunset, so a single
	// surviving call site is a future outage rather than a style slip. Scanning the
	// build rather than the source keeps explanatory comments about `/projects` legal;
	// `removeComments` is on, so only real paths reach dist.
	it('leaves no /projects call anywhere in the built node', () => {
		const root = join(__dirname, '..', 'nodes');
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.name.endsWith('.js')) files.push(full);
			}
		};
		walk(root);

		assert.ok(files.length > 0, `no built node files found under ${root}`);
		const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('/projects'));
		assert.deepEqual(offenders, []);
	});
});
