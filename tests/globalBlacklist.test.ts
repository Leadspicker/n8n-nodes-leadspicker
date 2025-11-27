import { strict as assert } from 'node:assert';
import { Leadspicker } from '../nodes/Leadspicker/Leadspicker.node';

const leadspickerInternal = Leadspicker as any;

describe('Global blacklist helpers', () => {
	describe('splitIdentifierString', () => {
		it('splits multiline payloads and trims entries', () => {
			const payload =
				'  alice@example.com  \n\n   https://linkedin.com/in/alice  \r\n example.com \n';
			const result = leadspickerInternal.splitIdentifierString(payload);
			assert.deepEqual(result, [
				'alice@example.com',
				'https://linkedin.com/in/alice',
				'example.com',
			]);
		});

		it('returns an empty array for non-string inputs', () => {
			assert.deepEqual(leadspickerInternal.splitIdentifierString(undefined), []);
			assert.deepEqual(leadspickerInternal.splitIdentifierString(123), []);
		});
	});

	describe('categorizeBlacklistEntries', () => {
		it('groups identifiers into email, linkedin, company linkedin, and domain buckets', () => {
			const entries = [
				'alice@example.com',
				'https://www.linkedin.com/in/alice',
				'https://linkedin.com/company/example-co',
				'https://linkedin.com/school/example-university',
				'example.com',
				'http://linkedin.com/in/BOB',
				'acme.org',
				'somelinkedin.com',
			];

			const result = leadspickerInternal.categorizeBlacklistEntries(entries);

			assert.deepEqual(result, {
				emails: ['alice@example.com'],
				linkedins: ['https://www.linkedin.com/in/alice', 'http://linkedin.com/in/BOB'],
				company_linkedins: [
					'https://linkedin.com/company/example-co',
					'https://linkedin.com/school/example-university',
				],
				domains: ['example.com', 'acme.org', 'somelinkedin.com'],
			});
		});
	});
});
