import { strict as assert } from 'node:assert';
import type { IExecuteFunctions } from 'n8n-workflow';
import { LeadspickerNode } from '../nodes/LeadspickerNode/LeadspickerNode.node';

type ParamMap = Record<string, unknown>;

function createBaseParams(): ParamMap {
	return {
		leadCountry: '',
		leadFullName: '',
		leadEmail: '',
		leadFirstName: '',
		leadLastName: '',
		leadPosition: '',
		leadCompanyName: '',
		leadCompanyWebsite: '',
		leadCompanyLinkedin: '',
		leadLinkedin: '',
		leadSalesNavigator: '',
		customFields: { field: [] },
	};
}

function createTestContext(params: ParamMap): IExecuteFunctions {
	return {
		getNodeParameter(name: string) {
			if (!(name in params)) {
				throw new Error(`Parameter "${name}" was not provided in test setup.`);
			}
			return params[name];
		},
		getNode() {
			return { name: 'Leadspicker Test Node' } as any;
		},
	} as unknown as IExecuteFunctions;
}

function buildPayload(overrides: ParamMap = {}) {
	const params = { ...createBaseParams(), ...overrides };
	if (!params.customFields) {
		params.customFields = { field: [] };
	}
	const context = createTestContext(params);
	return (LeadspickerNode as any).buildLeadPayload(context, 0) as Record<string, unknown>;
}

describe('LeadspickerNode.buildLeadPayload', () => {
	it('builds payload from direct fields', () => {
		const payload = buildPayload({
			leadFirstName: 'Jane',
			leadLastName: 'Doe',
			leadEmail: 'jane@example.com',
			leadCountry: 'US',
			leadPosition: '',
		});

		assert.equal(payload.first_name, 'Jane');
		assert.equal(payload.last_name, 'Doe');
		assert.equal(payload.email, 'jane@example.com');
		assert.equal(payload.country, 'US');
		assert.equal(payload.data_source, 'user_provided');
		assert.ok(!('position' in payload));
	});

	it('overrides with full name tokens when at least two words provided', () => {
		const payload = buildPayload({
			leadFullName: 'Mary Ann Smith Jr',
			leadFirstName: 'Original',
			leadLastName: 'Name',
		});

		assert.equal(payload.first_name, 'Mary');
		assert.equal(payload.last_name, 'Ann Smith Jr');
	});

	it('keeps individual names when full name has a single word', () => {
		const payload = buildPayload({
			leadFullName: 'Zendaya',
			leadFirstName: 'Zendaya',
			leadLastName: 'Coleman',
		});

		assert.equal(payload.first_name, 'Zendaya');
		assert.equal(payload.last_name, 'Coleman');
	});

	it('converts custom fields into key-value pairs', () => {
		const payload = buildPayload({
			customFields: {
				field: [
					{ key: 'source', value: 'web' },
					{ key: '', value: 'ignored' },
					{ key: 'missingValue', value: '' },
				],
			},
		});

		assert.deepEqual(payload.custom_fields, { source: 'web' });
	});
});
