import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LeadspickerApi implements ICredentialType {
	name = 'leadspickerApi';
	displayName = 'Leadspicker API';
	documentationUrl = 'https://app.leadspicker.com/app/sb/api/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
		},
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: 'https://app.leadspicker.com',
			//default: 'http://localhost:8000',
		},
	];

	// This allows the credential to be used by other parts of n8n
	// stating how this credential is injected as part of the request
	// An example is the Http Request node that can make generic calls
	// reusing this credential
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.token}}',
			},
		},
	};

	// The block below tells how this credential can be tested
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.domain}}',
			url: '/app/sb/api/auth/me',
		},
	};
}
