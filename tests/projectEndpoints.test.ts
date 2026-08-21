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

const API = 'https://app.leadspicker.com/app/sb/api';

describe('Project kind endpoints', () => {
	describe('campaign operations address a kind prefix, never /projects', () => {
		it('deletes through the sequence prefix, which serves either kind', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext(
				{ operation: 'delete', projectDeleteId: '42' },
				requests,
			);

			await (Leadspicker as any).handleCampaignOperations(context, 0);

			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'DELETE');
			assert.equal(requests[0].url, `${API}/sequences/42`);
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
			assert.equal(requests[0].url, `${API}/sequences/7/blacklist-text`);
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
			assert.equal(requests[0].url, `${API}/sequences/7/blacklist-text`);
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
			assert.ok(
				requests[0].url.startsWith(`${API}/sequences/9/events?`),
				`unexpected url: ${requests[0].url}`,
			);
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

			assert.deepEqual(
				requests.map((r) => r.url),
				[`${API}/lists/simple`],
			);
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

			assert.deepEqual(requests.map((r) => r.url).sort(), [
				`${API}/lists/simple`,
				`${API}/sequences/simple`,
			]);
			// Each listing is newest-first on its own; the merge restores that across kinds.
			assert.deepEqual(options, [
				{ name: 'Nordics (List)', value: '2' },
				{ name: 'Q3 cold email (Sequence)', value: '3' },
				{ name: 'DACH founders (List)', value: '1' },
			]);
		});

		it('feeds the trigger event filter from both kinds too', async () => {
			const requests: RecordedRequest[] = [];
			const context = createContext({}, requests, responder);

			const options = await loadOptions(new LeadspickerTrigger()).getCampaigns.call(context);

			assert.deepEqual(requests.map((r) => r.url).sort(), [
				`${API}/lists/simple`,
				`${API}/sequences/simple`,
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
