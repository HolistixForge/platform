/**
 * Credential Providers Configuration
 *
 * Defines all available credential providers for the gateway.
 * These are registered with CredentialProviderRegistry at startup.
 *
 * Modules that need credentials (like Notion, Airtable) export their
 * provider definitions here, and gateway registers them centrally.
 */

import type {
  TApiKeyCredentialProvider,
  TOAuthCredentialProvider,
  TCredentialProvider,
} from '@holistix-forge/gateway';

// =============================================================================
// NOTION PROVIDERS
// =============================================================================

export const notionOAuthProvider: TOAuthCredentialProvider = {
  id: 'notion_oauth',
  displayName: 'Notion (OAuth)',
  description: 'Connect your Notion workspace via OAuth authorization',
  icon: 'notion',
  collectionMethod: 'oauth',
  oauth: {
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientIdEnvVar: 'NOTION_CLIENT_ID',
    clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
    scopes: [],
    pkce: false,
    authorizationParams: {
      owner: 'user',
    },
  },
};

export const notionApiKeyProvider: TApiKeyCredentialProvider = {
  id: 'notion_api_key',
  displayName: 'Notion (API Key)',
  description: 'Use a Notion Internal Integration token',
  icon: 'notion',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Integration Token',
      type: 'password',
      placeholder: 'secret_xxx...',
      helpText: 'Create an internal integration at notion.so/my-integrations',
      required: true,
    },
  ],
  validationEndpoint: 'https://api.notion.com/v1/users/me',
};

// =============================================================================
// AIRTABLE PROVIDERS
// =============================================================================

export const airtableOAuthProvider: TOAuthCredentialProvider = {
  id: 'airtable_oauth',
  displayName: 'Airtable (OAuth)',
  description: 'Connect your Airtable workspace via OAuth',
  icon: 'airtable',
  collectionMethod: 'oauth',
  oauth: {
    authorizationUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    clientIdEnvVar: 'AIRTABLE_CLIENT_ID',
    clientSecretEnvVar: 'AIRTABLE_CLIENT_SECRET',
    scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
    pkce: true,
  },
};

export const airtableApiKeyProvider: TApiKeyCredentialProvider = {
  id: 'airtable_api_key',
  displayName: 'Airtable (API Key)',
  description: 'Use an Airtable Personal Access Token',
  icon: 'airtable',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Personal Access Token',
      type: 'password',
      placeholder: 'patXXX...',
      helpText: 'Create at airtable.com/create/tokens',
      required: true,
    },
  ],
  validationEndpoint: 'https://api.airtable.com/v0/meta/whoami',
};

// =============================================================================
// AI PROVIDERS
// =============================================================================

export const openaiApiKeyProvider: TApiKeyCredentialProvider = {
  id: 'openai_api_key',
  displayName: 'OpenAI',
  description: 'API key for OpenAI services (GPT, DALL-E, Whisper)',
  icon: 'openai',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'api_key',
      label: 'API Key',
      type: 'password',
      placeholder: 'sk-xxx...',
      helpText: 'Get your API key from platform.openai.com',
      required: true,
    },
  ],
};

export const anthropicApiKeyProvider: TApiKeyCredentialProvider = {
  id: 'anthropic_api_key',
  displayName: 'Anthropic',
  description: 'API key for Anthropic Claude models',
  icon: 'anthropic',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'api_key',
      label: 'API Key',
      type: 'password',
      placeholder: 'sk-ant-xxx...',
      helpText: 'Get your API key from console.anthropic.com',
      required: true,
    },
  ],
};

// =============================================================================
// VCS PROVIDERS
// =============================================================================

export const githubTokenProvider: TApiKeyCredentialProvider = {
  id: 'github_token',
  displayName: 'GitHub',
  description: 'Personal access token for GitHub API',
  icon: 'github',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Personal Access Token',
      type: 'password',
      placeholder: 'ghp_xxx...',
      helpText: 'Create at github.com/settings/tokens',
      required: true,
    },
  ],
};

export const gitlabTokenProvider: TApiKeyCredentialProvider = {
  id: 'gitlab_token',
  displayName: 'GitLab',
  description: 'Personal access token for GitLab API',
  icon: 'gitlab',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Personal Access Token',
      type: 'password',
      placeholder: 'glpat-xxx...',
      helpText: 'Create at gitlab.com/-/profile/personal_access_tokens',
      required: true,
    },
  ],
};

// =============================================================================
// COMMUNICATION PROVIDERS
// =============================================================================

export const slackTokenProvider: TApiKeyCredentialProvider = {
  id: 'slack_token',
  displayName: 'Slack',
  description: 'Bot or user token for Slack API',
  icon: 'slack',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Bot Token',
      type: 'password',
      placeholder: 'xoxb-xxx...',
      helpText: 'Create a Slack app at api.slack.com/apps',
      required: true,
    },
  ],
};

export const discordTokenProvider: TApiKeyCredentialProvider = {
  id: 'discord_token',
  displayName: 'Discord',
  description: 'Bot token for Discord API',
  icon: 'discord',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'token',
      label: 'Bot Token',
      type: 'password',
      placeholder: 'MTIzNDU2Nzg5...',
      helpText: 'Create at discord.com/developers/applications',
      required: true,
    },
  ],
};

// =============================================================================
// GENERIC PROVIDER
// =============================================================================

export const genericApiKeyProvider: TApiKeyCredentialProvider = {
  id: 'generic_api_key',
  displayName: 'Generic API Key',
  description: 'A generic API key for any third-party service',
  icon: 'key',
  collectionMethod: 'api_key',
  fields: [
    {
      name: 'api_key',
      label: 'API Key',
      type: 'password',
      placeholder: 'Enter your API key',
      required: true,
    },
    {
      name: 'service_name',
      label: 'Service Name',
      type: 'text',
      placeholder: 'e.g., My Custom API',
      helpText: 'Name of the service this key is for',
      required: false,
    },
  ],
};

// =============================================================================
// ALL PROVIDERS
// =============================================================================

/**
 * All available credential providers
 * These are registered with CredentialProviderRegistry at gateway startup
 */
export const allCredentialProviders: TCredentialProvider[] = [
  // Notion
  notionOAuthProvider,
  notionApiKeyProvider,
  // Airtable
  airtableOAuthProvider,
  airtableApiKeyProvider,
  // AI
  openaiApiKeyProvider,
  anthropicApiKeyProvider,
  // VCS
  githubTokenProvider,
  gitlabTokenProvider,
  // Communication
  slackTokenProvider,
  discordTokenProvider,
  // Generic
  genericApiKeyProvider,
];

/**
 * Register all providers with the credential manager
 */
export function registerAllProviders(credentialManager: {
  getProviderRegistry: () => { register: (p: TCredentialProvider) => void };
}): void {
  const registry = credentialManager.getProviderRegistry();
  for (const provider of allCredentialProviders) {
    registry.register(provider);
  }
}
