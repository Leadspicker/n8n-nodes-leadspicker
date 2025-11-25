import type { INodeProperties } from 'n8n-workflow';

export const linkedinActivityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
			},
		},
		options: [
			{
				name: 'Get Activities',
				value: 'getActivities',
				description: "Get a profile's recent activities (reactions and comments)",
				action: 'Get recent profile activities',
			},
			{
				name: 'Get Interactions for LinkedIn Post Search',
				value: 'searchPostReactors',
				description:
					'Retrieve LinkedIn profiles that interacted with posts returned by a content search URL',
				action: 'Get interactions for linkedin post search',
			},
			{
				name: 'Get Interactions for Profiles',
				value: 'profilesPostReactors',
				description: 'Retrieve interactors for posts authored by specific LinkedIn profiles',
				action: 'Get interactors for profiles',
			},
			{
				name: 'Get Post Interactors',
				value: 'getPostReactors',
				description: 'Get people who interact with posts and send to a webhook',
				action: 'Get post interactors',
			},
			{
				name: 'Get Profile Details',
				value: 'getProfile',
				description: 'Scrapes and returns details for a LinkedIn profile',
				action: 'Get profile details',
			},
			{
				name: 'Get Recent Profile Posts',
				value: 'getPosts',
				description: "Get profile's recent posts",
				action: 'Get recent profile posts',
			},
		],
		default: 'getProfile',
	},
];

export const linkedinActivityFields: INodeProperties[] = [
	{
		displayName: 'LinkedIn Profile URL',
		name: 'linkedinUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getPosts', 'getActivities', 'getProfile'],
			},
		},
		default: '',
		description: 'The LinkedIn URL of the personal or company profile',
	},
	{
		displayName: 'Activity Section',
		name: 'includeActivityCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the recent activity section in the response',
	},
	{
		displayName: 'Adjacent Section',
		name: 'includeAdjacentCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the adjacent/related profiles section',
	},
	{
		displayName: 'Education Section',
		name: 'includeEducationCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the education section',
	},
	{
		displayName: 'Experience Section',
		name: 'includeExperienceCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the experience section',
	},
	{
		displayName: 'Followers Section',
		name: 'includeFollowersCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the follower stats section',
	},
	{
		displayName: 'Location Section',
		name: 'includeLocationCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the location information section',
	},
	{
		displayName: 'Overview Section',
		name: 'includeOverviewCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the overview/about section',
	},
	{
		displayName: 'Skills Section',
		name: 'includeSkillsCard',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getProfile'],
			},
		},
		description: 'Whether to include the skills section',
	},
	{
		displayName: 'Search URL',
		name: 'searchUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['searchPostReactors'],
			},
		},
		default: '',
		description: 'The LinkedIn content search URL to iterate posts from',
	},
	{
		displayName: 'Include Likers',
		name: 'includeSearchLikers',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['searchPostReactors'],
			},
		},
		description: 'Whether to include likers per post automatically (max 10 by default)',
	},
	{
		displayName: 'Include Commenters',
		name: 'includeSearchCommenters',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['searchPostReactors'],
			},
		},
		description: 'Whether to include commenters per post automatically (max 10 by default)',
	},
	{
		displayName: 'Profile URLs',
		name: 'profilesList',
		type: 'fixedCollection',
		placeholder: 'Add Profile URL',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['profilesPostReactors'],
			},
		},
		description: 'A list of LinkedIn profile URLs to get interactors from',
		options: [
			{
				name: 'profiles',
				displayName: 'Profile',
				values: [
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						default: '',
						description: 'A LinkedIn profile URL',
					},
				],
			},
		],
	},
	{
		displayName: 'Include Likers',
		name: 'includePostLikers',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['profilesPostReactors'],
			},
		},
		description: 'Whether to include likers per post (max 10 by default)',
	},
	{
		displayName: 'Include Commenters',
		name: 'includePostCommenters',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['profilesPostReactors'],
			},
		},
		description: 'Whether to include commenters per post (max 10 by default)',
	},
	{
		displayName: 'Webhook URL',
		name: 'webhookUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getPostReactors'],
			},
		},
		default: '',
		description: 'The URL to send the webhook payload to when data is ready',
	},
	{
		displayName: 'Profile URLs',
		name: 'profileUrls',
		type: 'fixedCollection',
		placeholder: 'Add Profile URL',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getPostReactors'],
			},
		},
		description: 'A list of LinkedIn profile URLs to get post interactors from',
		options: [
			{
				name: 'urls',
				displayName: 'URL',
				values: [
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						default: '',
						description: 'A LinkedIn profile URL',
					},
				],
			},
		],
	},
	{
		displayName: 'Post Interactors Options',
		name: 'postReactorsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['getPostReactors'],
			},
		},
		options: [
			{
				displayName: 'Max Post Age (Days)',
				name: 'maxPostsAge',
				type: 'number',
				default: 90,
				description: 'The maximum age of posts to consider, in days',
			},
			{
				displayName: 'Max Posts per Profile',
				name: 'maxPostsPerLink',
				type: 'number',
				default: 30,
				description: 'The maximum number of posts to check per profile URL',
			},
			{
				displayName: 'Max Interactors per Post',
				name: 'maxReactors',
				type: 'number',
				default: 50,
				description: 'The maximum number of interactors to return per post',
			},
		],
	},
	{
		displayName: 'Interactors Search Options',
		name: 'reactorsSearchOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['linkedinActivity'],
				operation: ['searchPostReactors', 'profilesPostReactors'],
			},
		},
		options: [
			{
				displayName: 'Deduplicate',
				name: 'deduplicate',
				type: 'boolean',
				default: false,
				description: 'Whether to deduplicate interactors across posts',
			},
			{
				displayName: 'Include Author',
				name: 'includeAuthor',
				type: 'boolean',
				default: false,
				description: 'Whether to include the post author in the results',
			},
			{
				displayName: 'Max Age Days',
				name: 'maxAgeDays',
				type: 'number',
				default: 90,
				description: 'Only consider posts up to this age in days',
			},
			{
				displayName: 'Max Commenters Per Post',
				name: 'commentersPerPost',
				type: 'number',
				default: 0,
				description: 'Maximum number of commenters to return per post',
			},
			{
				displayName: 'Max Likers Per Post',
				name: 'likersPerPost',
				type: 'number',
				default: 0,
				description: 'Maximum number of likers to return per post',
			},
			{
				displayName: 'Posts Limit',
				name: 'postsLimit',
				type: 'number',
				default: 30,
				description: 'Maximum number of posts to iterate per request',
			},
		],
	},
];
