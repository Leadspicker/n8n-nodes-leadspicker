import { strict as assert } from 'node:assert';
import type { INodeProperties } from 'n8n-workflow';
import { Leadspicker } from '../nodes/Leadspicker/Leadspicker.node';
import { LeadspickerTrigger } from '../nodes/Leadspicker/LeadspickerTrigger.node';

/**
 * n8n persists a node's `resource`, `operation`, parameter names and option values
 * verbatim into every saved workflow's JSON. A workflow built against an earlier
 * release replays those strings; anything renamed here silently stops resolving,
 * and the node either loses a setting or fails at run time.
 *
 * Display names, descriptions and actions are not persisted, so the List/Sequence
 * rename is free — but only as long as it stays on that side of the line. These
 * snapshots come from 0.4.4, the last release before the endpoint split.
 */

const PARAMETER_KEYS_0_4_4 = [
	'additionalOptions', 'address', 'blacklistEntry', 'bulkLeads', 'commentersPerPost',
	'companyLinkedin', 'companyName', 'country', 'customFields', 'deduplicate', 'email',
	'embeddingsDistanceThreshold', 'enrichEmails', 'feature', 'field', 'function', 'functions',
	'functionValues', 'globalBlacklistEntry', 'globalExclusionListFilters', 'id', 'idManual',
	'includeActivityCard', 'includeAdjacentCard', 'includeAuthor', 'includeEducationCard',
	'includeExperienceCard', 'includeFollowersCard', 'includeLocationCard', 'includeOverviewCard',
	'includePostCommenters', 'includePostLikers', 'includeSearchCommenters', 'includeSearchLikers',
	'includeSkillsCard', 'key', 'lead', 'leadCompanyLinkedin', 'leadCompanyName',
	'leadCompanyWebsite', 'leadCountry', 'leadEmail', 'leadFirstName', 'leadFullName',
	'leadLastName', 'leadLinkedin', 'leadPosition', 'leadSalesNavigator', 'likersPerPost',
	'linkedin', 'linkedinUrl', 'liveCheckCurrentPosition', 'maxAgeDays', 'maxPostsAge',
	'maxPostsPerLink', 'maxReactors', 'memberId', 'operation', 'personId', 'personIdManual',
	'personLookupProjectId', 'personLookupProjectIdManual', 'position', 'postReactorsOptions',
	'postsLimit', 'profiles', 'profilesList', 'profileUrls', 'project', 'projectBlacklistId',
	'projectBlacklistIdManual', 'projectDeleteId', 'projectDeleteIdManual', 'projectId',
	'projectIdManual', 'projectLogEndDate', 'projectLogEventTypes', 'projectLogId',
	'projectLogIdManual', 'projectLogOutreachStepTypes', 'projectLogPersonId',
	'projectLogPersonIdManual', 'projectLogSearch', 'projectLogStartDate', 'projectName',
	'projects', 'projectTimezone', 'reactorsSearchOptions', 'replyFilters', 'resource',
	'salesnav', 'searchResultLimit', 'searchUrl', 'sentiment', 'type', 'url', 'urls',
	'useEmbeddingsSimilarity', 'value', 'webhookName', 'webhookUrl',
];

const CAMPAIGN_OPERATIONS_0_4_4 = [
	'addToExclusionList',
	'create',
	'delete',
	'getCampaignLog',
	'getExclusionList',
	'removeFromExclusionList',
];

/** Every parameter name reachable in the node, including nested collections. */
function collectParameterNames(properties: any[], into = new Set<string>()) {
	for (const property of properties ?? []) {
		if (typeof property?.name === 'string') into.add(property.name);
		for (const option of (property?.options ?? []) as any[]) {
			// `fixedCollection` nests its properties under each option's `values`;
			// `collection` puts them directly in `options`. A plain dropdown option is
			// `{ name, value }` with no `type`, and bottoms out here rather than being
			// mistaken for a parameter.
			if (Array.isArray(option?.values)) {
				// A fixedCollection option's own `name` is the key its entries are stored
				// under, so it is persisted just like a parameter name.
				if (typeof option.name === 'string') into.add(option.name);
				collectParameterNames(option.values, into);
			}
			else if (option && typeof option === 'object' && 'type' in option) {
				collectParameterNames([option], into);
			}
		}
	}
	return into;
}

function findProperty(properties: INodeProperties[], name: string) {
	const found = properties.find((property) => property.name === name);
	assert.ok(found, `parameter "${name}" no longer exists`);
	return found;
}

describe('Backwards compatibility with workflows saved before the endpoint split', () => {
	const node = new Leadspicker();
	const properties = node.description.properties;

	it('still exposes every parameter name a 0.4.4 workflow may have saved', () => {
		const current = collectParameterNames(properties as INodeProperties[]);
		// The trigger is a separate node type with its own saved parameters.
		collectParameterNames(new LeadspickerTrigger().description.properties as INodeProperties[], current);

		const missing = PARAMETER_KEYS_0_4_4.filter((key) => !current.has(key));
		assert.deepEqual(missing, []);
	});

	it('keeps the campaign resource under its original value', () => {
		const resource = findProperty(properties as INodeProperties[], 'resource');
		const values = (resource.options as any[]).map((option) => option.value);
		// Renaming the label to "List or Sequence" must not touch the stored value.
		assert.ok(values.includes('project'), 'resource value "project" was renamed');
		assert.equal(resource.default, 'project');
	});

	it('keeps every campaign operation under its original value', () => {
		const operation = properties.find(
			(property) =>
				property.name === 'operation' &&
				(property.displayOptions?.show?.resource as string[] | undefined)?.includes('project'),
		);
		assert.ok(operation, 'campaign operation property not found');
		const values = (operation.options as any[]).map((option) => option.value);
		// Subset, not equality: adding an operation is additive and safe, while losing
		// one orphans the workflows that stored it.
		const missing = CAMPAIGN_OPERATIONS_0_4_4.filter((op) => !values.includes(op));
		assert.deepEqual(missing, []);
	});

	it('keeps the manual-ID sentinel every project picker stores', () => {
		const pickers = [
			'projectDeleteId',
			'projectBlacklistId',
			'projectLogId',
			'projectId',
			'personLookupProjectId',
		];
		for (const name of pickers) {
			const picker = findProperty(properties as INodeProperties[], name);
			const values = (picker.options as any[]).map((option) => option.value);
			assert.ok(
				values.includes('__manual__'),
				`${name} lost the __manual__ sentinel, orphaning saved manual IDs`,
			);
			// The empty-string "select..." placeholder is stored too when nothing is picked.
			assert.ok(values.includes(''), `${name} lost its empty placeholder value`);
		}
	});
});
