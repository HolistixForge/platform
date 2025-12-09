# Credentials Wallet Architecture

## Overview

The Credentials Wallet is a secure storage system for users to manage their third-party software credentials and API keys. It enables seamless integration with external services (Notion, Airtable, GitHub, AWS, etc.) while maintaining security and user control.

## Primary Use Cases

### 1. Frontend-First Credential Usage

**Primary Pattern:** Credentials are primarily used in the **frontend** for direct API calls to third-party services, NOT in gateway reducers that affect all users.

**Why Frontend-First?**

- **Permission Enforcement**: Each user should fetch their own data using their own credentials, ensuring proper access control
- **Security**: Prevents unauthorized data exposure by avoiding server-side fetching that could leak data to all users
- **User Privacy**: Respects third-party service permissions - users only see what they have access to

**Example: Third-Party Chat Integration**

- A chat application node is defined in the whiteboard graph
- The **conversation ID** is stored in shared state (accessible to all users)
- Each user's browser fetches the actual chat content using their own credentials via direct API calls
- Only users with proper access rights can view the content
- This pattern ensures permission boundaries are respected

### 2. Gateway API Proxy (When Frontend Direct Calls Are Not Possible)

**Use Case:** Some third-party APIs do not accept requests from frontends due to:

- CORS restrictions
- Security policies that block browser-originated requests
- API keys that must not be exposed to frontend code
- Rate limiting based on server IP rather than client IP

**Solution:** Gateway implements a general API proxy that:

- Accepts requests from frontend with a `credential_id` parameter
- Fetches the actual credential from Ganymede (decrypted)
- Replaces the `credential_id` with the actual token/key
- Forwards the request to the third-party API
- Returns the response to the frontend
- **Credentials never leak to frontend** - they stay encrypted until used in the proxy

**Pattern:**

```
Frontend → Gateway Proxy → Third-Party API
         (credential_id)    (actual token/key)
```

**Security Benefits:**

- Credentials remain encrypted in database
- Credentials are only decrypted server-side in the gateway
- Frontend never sees actual credential values
- Each user's request uses their own credential (or shared credential they have access to)

### 3. Credential Sharing & Delegation

Users can grant others to act on their behalf by sharing credentials at different scopes:

- **Organization-level**: Share with all members of an organization
- **Project-level**: Share with all members of a specific project
- **Resource-level**: Share with users who have access to a specific resource (e.g., a specific node or component)

## Design Goals

1. **User Ownership**: Users own and control their credentials
2. **Security**: Encryption at rest, secure transmission, access control
3. **Permission Respect**: Frontend usage ensures third-party permissions are properly enforced
4. **Granular Sharing**: Support organization, project, and resource-level credential sharing
5. **Integration**: Seamless use by frontend modules for direct API calls
6. **User Experience**: Easy management through UI

---

## Architecture Integration

### Where It Fits

The Credentials Wallet should be implemented as a **cross-cutting concern** that spans multiple layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Credentials Wallet UI Module                        │   │
│  │  - List credentials                                   │   │
│  │  - Add/Edit/Delete credentials                       │   │
│  │  - Share credentials (org/project/resource)            │   │
│  │  - Integration with module UIs                       │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │  Integration Modules (Notion, Airtable, Chat, etc.)  │ │
│  │  - Direct API calls (when possible)                   │ │
│  │  - Gateway proxy calls (when needed)                  │ │
│  │  - Each user uses their own credentials                │ │
│  │  - Permission-aware data fetching                      │ │
│  └───────────────────────┬───────────────────────────────┘ │
└──────────────────────────┼─────────────────────────────────┘
                            │ HTTPS (REST API)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Ganymede (API Server)                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Credentials Wallet Service                           │ │
│  │  - CRUD operations                                    │ │
│  │  - Encryption/Decryption                              │ │
│  │  - Access control (user/org/project/resource)        │ │
│  │  - Credential validation                              │ │
│  │  - Sharing management                                 │ │
│  └───────────────────────┬───────────────────────────────┘ │
│                          │                                 │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │  PostgreSQL Database                                 │ │
│  │  - credentials table (encrypted)                     │ │
│  │  - credential_shares table (sharing permissions)     │ │
│  │  - credential_metadata table                         │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ JWT (credential retrieval)
┌───────────────────────▼─────────────────────────────────────┐
│              Gateway (Per-Organization)                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  API Proxy Service                                    │ │
│  │  - Accepts requests with credential_id                │ │
│  │  - Fetches credential from Ganymede                   │ │
│  │  - Replaces credential_id with actual token/key       │ │
│  │  - Forwards to third-party API                        │ │
│  │  - Returns response to frontend                       │ │
│  └───────────────────────┬───────────────────────────────┘ │
│                          │                                 │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │  Shared State (Yjs)                                    │ │
│  │  - Conversation IDs, resource IDs                      │ │
│  │  - Metadata (NOT sensitive data)                      │ │
│  │  - Resource identifiers only (no credential references)│ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Database Schema (Ganymede)

**Table: `credentials`**

- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → users.id) - Owner of the credential
- `credential_type` (VARCHAR) - e.g., 'notion_api_key', 'aws_access_key', 'github_token', 'slack_token'
- `name` (VARCHAR) - User-friendly name
- `encrypted_value` (TEXT) - AES-256-GCM encrypted credential
- `encryption_key_id` (VARCHAR) - Reference to encryption key version
- `metadata` (JSONB) - Additional data (expiry, scopes, etc.)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `last_used_at` (TIMESTAMP, nullable)
- `is_active` (BOOLEAN, default true)

**Table: `credential_shares`**

- `id` (UUID, primary key)
- `credential_id` (UUID, foreign key → credentials.id)
- `share_scope` (VARCHAR) - 'organization', 'project', 'resource'
- `organization_id` (UUID, nullable, foreign key → organizations.id)
  - Required if `share_scope = 'organization'`
- `project_id` (UUID, nullable, foreign key → projects.id)
  - Required if `share_scope = 'project'`
- `resource_id` (UUID, nullable) - Generic resource identifier
  - Required if `share_scope = 'resource'`
  - Can reference graph nodes, components, etc.
- `granted_by` (UUID, foreign key → users.id) - User who granted the share
- `granted_at` (TIMESTAMP)
- `revoked_at` (TIMESTAMP, nullable)
- `is_active` (BOOLEAN, default true)

**Table: `credential_metadata`**

- `credential_type` (VARCHAR, primary key) - Defined by modules (e.g., 'notion_api_key', 'slack_token')
- `display_name` (VARCHAR) - Provided by module
- `description` (TEXT) - Provided by module
- `icon_url` (VARCHAR, nullable) - Provided by module
- `validation_schema` (JSONB) - JSON schema for validation (provided by module)
- `required_fields` (JSONB) - Fields required for this type (provided by module)
- `encryption_required` (BOOLEAN, default true)
- `module_name` (VARCHAR) - Module that defines this credential type

**Indexes:**

- `credentials_user_id_idx` on `(user_id, is_active)`
- `credentials_type_idx` on `(credential_type)`
- `credential_shares_credential_id_idx` on `(credential_id, is_active)`
- `credential_shares_org_idx` on `(organization_id, is_active)` where `share_scope = 'organization'`
- `credential_shares_project_idx` on `(project_id, is_active)` where `share_scope = 'project'`
- `credential_shares_resource_idx` on `(resource_id, is_active)` where `share_scope = 'resource'`

### 2. Ganymede API Endpoints

**Base Path:** `/api/credentials`

#### `GET /api/credentials`

- List user's credentials and shared credentials they have access to
- Query params:
  - `?type=notion_api_key` - Filter by credential type
  - `?organization_id=...` - Include org-shared credentials
  - `?project_id=...` - Include project-shared credentials
  - `?resource_id=...` - Include resource-shared credentials
  - `?include_shared=true` - Include all accessible shared credentials
- Auth: Session cookie
- Response: `{ credentials: CredentialSummary[] }`
- **Note:** Returns credential summaries (no decrypted values)

#### `GET /api/credentials/{id}`

- Get credential details (decrypted value)
- Auth: Session cookie + ownership check
- Response: `{ credential: CredentialDetail }`

#### `POST /api/credentials`

- Create new credential
- Body: `{ type, name, value, organization_id?, metadata? }`
- Auth: Session cookie
- Response: `{ credential: CredentialDetail }`
- **Encryption happens server-side**

#### `PATCH /api/credentials/{id}`

- Update credential
- Body: `{ name?, value?, metadata?, is_active? }`
- Auth: Session cookie + ownership check

#### `DELETE /api/credentials/{id}`

- Delete credential (soft delete: set `is_active = false`)
- Auth: Session cookie + ownership check

#### `POST /api/credentials/{id}/validate`

- Validate credential (test connection)
- Auth: Session cookie + ownership check
- Response: `{ valid: boolean, message?: string }`

#### `GET /api/credentials/types`

- List available credential types with metadata
- Auth: Session cookie
- Response: `{ types: CredentialTypeMetadata[] }`
- **Note:** Types are registered by modules when they are loaded

#### `POST /api/credentials/types` ???

- Register a new credential type (called by modules on load)
- Body: `{ credentialTypeId, displayName, description, icon, validationSchema, collectionMethod, oauthConfig? }`
- Auth: Internal (module registration)
- Response: `{ success: true }`

#### `POST /api/credentials/{id}/share`

- Share credential with organization, project, or resource
- Body: `{ share_scope: 'organization' | 'project' | 'resource', organization_id?, project_id?, resource_id? }`
- Auth: Session cookie + ownership check
- Response: `{ share: CredentialShare }`

#### `DELETE /api/credentials/{id}/share/{share_id}`

- Revoke a credential share
- Auth: Session cookie + ownership check
- Response: `{ success: true }`

#### `GET /api/credentials/{id}/shares`

- List all shares for a credential
- Auth: Session cookie + ownership check
- Response: `{ shares: CredentialShare[] }`

### 3. Gateway API Proxy Endpoints

**Purpose:** Proxy third-party API requests when direct frontend calls are not possible (CORS, security policies, etc.)

**Base Path:** `/api/proxy/{service}` (per organization gateway)

#### `GET /api/proxy/{service}/*`

- Proxy GET request to third-party service
- Query params: `credential_id={id}` - Required, identifies which credential to use
- All other query params and path segments are forwarded to the third-party API
- Auth: Session cookie (validates user has access to credential)
- Gateway:
  1. Validates user has access to credential (owns or has share access)
  2. Fetches credential from Ganymede (decrypted)
  3. Replaces `credential_id` param with actual token/key
  4. Forwards request to third-party API
  5. Returns response to frontend

#### `POST /api/proxy/{service}/*`

- Proxy POST request to third-party service
- Body: Can include `credential_id` field (will be replaced with actual credential)
- Query params: `credential_id={id}` - Required
- Auth: Session cookie
- Gateway: Same process as GET

#### `PUT /api/proxy/{service}/*`, `PATCH /api/proxy/{service}/*`, `DELETE /api/proxy/{service}/*`

- Proxy other HTTP methods similarly

**Example Usage:**

```typescript
// Frontend: Call third-party API via proxy
const response = await fetch(
  `${gatewayUrl}/api/proxy/notion/v1/databases/${databaseId}?credential_id=${credentialId}`,
  {
    headers: {
      'Notion-Version': '2022-06-28',
    },
  }
);

// Gateway:
// 1. Extracts credential_id from query
// 2. Fetches credential from Ganymede: GET /api/credentials/{credential_id}
// 3. Makes request to: https://api.notion.com/v1/databases/{databaseId}
//    with header: Authorization: Bearer {decrypted_credential_value}
// 4. Returns response to frontend
```

**Security:**

- Credentials are never exposed to frontend
- Each request validates user has access to the credential
- Gateway acts as a secure intermediary
- Credentials remain encrypted until used in the proxy

### 4. Module-Defined Credential Providers

**Purpose:** Modules define their own credential types and collection methods for the services they integrate with.

**How Modules Define Credential Types:**

Each module that requires third-party credentials can define:

- **Credential Type ID**: Unique identifier (e.g., `notion_api_key`, `slack_token`, `github_pat`)
- **Icon**: Icon to display in the credentials wallet UI
- **Collection Method**: How to obtain the credential (API key input or OAuth flow)
- **Validation Schema**: How to validate the credential

**Module Registration Pattern:**

```typescript
// In a module (e.g., packages/modules/notion/src/index.ts)
export const moduleFrontend: ModuleFrontend = {
  credentialProviders: [
    {
      credentialTypeId: 'notion_api_key',
      displayName: 'Notion API Key',
      description: 'Your Notion integration API key',
      icon: '/icons/notion.svg',
      collectionMethod: 'api_key', // or 'oauth'
      validationSchema: {
        type: 'string',
        pattern: '^secret_[a-zA-Z0-9]+$',
      },
      // For OAuth flows:
      // oauthConfig: {
      //   authorizationUrl: 'https://notion.so/oauth/authorize',
      //   tokenUrl: 'https://notion.so/oauth/token',
      //   clientId: '...',
      //   scopes: ['read', 'write'],
      // }
    },
  ],
};
```

**Credential Collection Flow:**

1. **API Key Method:**

   - Module prompts user for API key input
   - User enters API key in a form
   - Module calls `POST /api/credentials` with the credential
   - Credential is encrypted and stored

2. **OAuth Method:**
   - Module initiates OAuth flow (opens popup or redirects)
   - User authorizes on third-party service
   - OAuth callback returns authorization code
   - Module exchanges code for access token
   - Module calls `POST /api/credentials` with the token
   - Credential is encrypted and stored

**Module Integration:**

```typescript
// In a module component
function NotionNode({ node }) {
  const { database_id } = node.data;

  // Check if user has credential
  const { data: credentials } = useQueryCredentials(userId, {
    type: 'notion_api_key',
  });

  // If no credential, prompt user
  if (!credentials?.length) {
    return (
      <CredentialPrompt
        credentialTypeId="notion_api_key"
        onCredentialAdded={() => {
          // Credential is now stored in wallet, component will re-render
          // and fetch credential automatically
        }}
      />
    );
  }

  // Use credential to fetch data
  const { data: credential } = useQueryCredential(credentials[0].id);
  // ... fetch Notion data
}
```

**Credential Metadata Registration:**

When a module is loaded, it registers its credential types with Ganymede:

- Frontend module exports credential provider definitions
- On module load, metadata is sent to Ganymede
- Ganymede stores metadata in `credential_metadata` table
- Wallet UI uses this metadata to display credential types

### 5. Frontend Module: `credentials-wallet`

**Location:** `packages/modules/credentials-wallet/`

**Components:**

- `CredentialsList` - List all user credentials
- `CredentialForm` - Add/Edit credential
- `CredentialCard` - Display credential summary
- `CredentialTypeSelector` - Choose credential type
- `CredentialValidationStatus` - Show validation status

**Integration Points:**

- **Settings Page**: Full credential management UI
- **Module UIs**: Credential prompts and selectors when connecting services
  - Modules can prompt for credentials when needed
  - Credential selector component for choosing from existing credentials
  - OAuth flow handling for modules that use OAuth

**Hooks (in `frontend-data`):**

```typescript
// List credentials (including shared)
useQueryCredentials(userId, options?)

// Get credential (decrypted value for API calls)
useQueryCredential(credentialId)

// Create credential
useMutationCreateCredential()

// Update credential
useMutationUpdateCredential()

// Delete credential
useMutationDeleteCredential()

// Validate credential
useMutationValidateCredential()

// Share credential
useMutationShareCredential()

// Revoke share
useMutationRevokeCredentialShare()
```

**Frontend Usage Pattern:**

```typescript
// In a module component (e.g., SlackChatNode)
function SlackChatNode({ node }) {
  const { conversation_id, credential_id } = node.data;

  // Fetch credential from wallet (user's own or shared)
  const { data: credential } = useQueryCredential(credential_id);

  // Fetch chat content using user's credential
  const { data: messages } = useQuery(
    ['slack-messages', conversation_id],
    () => fetchSlackMessages(conversation_id, credential.value),
    { enabled: !!credential }
  );

  // Only users with proper access will see messages
  return <ChatMessages messages={messages} />;
}
```

---

## Security Considerations

### Encryption

1. **At Rest:**

   - Use AES-256-GCM encryption
   - Master encryption key stored in environment variable (`CREDENTIALS_ENCRYPTION_KEY`)
   - Key rotation: Support multiple key versions via `encryption_key_id`
   - Never log decrypted values

2. **In Transit:**

   - All API calls over HTTPS
   - Gateway-to-Ganymede: JWT tokens
   - Frontend-to-Ganymede: Session cookies

3. **Access Control:**
   - **User-owned**: Users can access their own credentials
   - **Organization-shared**: Users can access if they're members of the organization
   - **Project-shared**: Users can access if they're members of the project
   - **Resource-shared**: Users can access if they have access to the specific resource
   - **Frontend direct calls**: Credentials are decrypted in frontend (when API allows)
   - **Gateway proxy**: Credentials are decrypted only server-side, never exposed to frontend

### Key Management

- **Development:** Single key in `.env.ganymede`
- **Production:** Use key management service (AWS KMS, HashiCorp Vault, etc.)
- **Key Rotation:** Support multiple key versions, re-encrypt on access

### Audit Trail

- Log credential access (who, when, which credential)
- Track last_used_at for credential lifecycle management
- Alert on suspicious access patterns

---

## Integration with Existing Modules

### Third-Party Chat Module (Example)

**Use Case:** Slack/Discord chat integration in whiteboard

**Pattern:**

1. User creates a chat node in the whiteboard
2. Module prompts user for credential (if not already stored)
   - User can enter API key or complete OAuth flow
   - Credential is stored in wallet
3. **Shared state** stores:
   - `conversation_id` (channel/conversation identifier)
   - Node metadata
   - **Note:** No credential_id in shared state - each user uses their own
4. **Each user's frontend:**
   - Fetches their own credential from wallet (or uses shared credential they have access to)
   - Makes direct API call to third-party service
   - Only sees content they have permission to view

**Event Flow:**

```typescript
// Frontend: User creates chat node
// Module prompts for credential if needed
const credential = await promptForCredential('slack_token');

dispatch({
  type: 'slack-chat:create-node',
  conversation_id: 'C123456',
  // No credential_id in event - each user uses their own
});

// Gateway reducer: Store conversation ID in shared state
async function createSlackChatNode(context, event) {
  // Store in shared state (accessible to all users)
  context.sharedData.nodes.set(event.node_id, {
    type: 'slack-chat',
    conversation_id: event.conversation_id,
    // NO credential_id - each user uses their own
  });
}

// Frontend: Each user fetches their own data
function SlackChatNode({ node }) {
  const { conversation_id } = node.data;

  // Fetch user's credential (or shared credential they have access to)
  const { data: credentials } = useQueryCredentials(userId, {
    type: 'slack_token',
  });
  const credential = credentials?.[0];

  // Option 1: Direct API call (if Slack API allows CORS)
  // Option 2: Gateway proxy (if CORS is blocked or for security)
  const useProxy = true; // Module configuration

  const { data: messages } = useQuery(
    ['slack-messages', conversation_id],
    () => {
      if (useProxy) {
        // Via gateway proxy - credential never exposed to frontend
        return fetch(
          `${gatewayUrl}/api/proxy/slack/conversations.history?channel=${conversation_id}&credential_id=${credential.id}`
        );
      } else {
        // Direct call - credential decrypted in frontend
        return fetchSlackAPI(`/conversations/${conversation_id}/messages`, {
          headers: { Authorization: `Bearer ${credential.value}` },
        });
      }
    },
    { enabled: !!credential }
  );

  // Only users with access see messages
  return <ChatView messages={messages} />;
}
```

### Notion Module

**Pattern:**

1. User creates Notion database node
2. Module prompts for credential if user doesn't have one
3. Shared state stores: `database_id` (no credential reference)
4. Each user's frontend fetches their own credential and database content
5. Permission enforcement: Users only see databases they have access to in Notion

**API Call Pattern:**

Notion API typically requires server-side calls (CORS restrictions), so use gateway proxy:

```typescript
// Frontend: Fetch Notion database via proxy
const { data: credentials } = useQueryCredentials(userId, {
  type: 'notion_api_key',
});
const credential = credentials?.[0];

const { data: database } = useQuery(
  ['notion-database', databaseId],
  () =>
    fetch(
      `${gatewayUrl}/api/proxy/notion/v1/databases/${databaseId}?credential_id=${credential.id}`,
      {
        headers: {
          'Notion-Version': '2022-06-28',
        },
      }
    ),
  { enabled: !!credential }
);
```

### Airtable Module

Similar pattern to Notion module - each user fetches their own data using their credentials.

**API Call Pattern:**

Airtable API allows direct frontend calls, so can use either pattern:

```typescript
// Option 1: Direct call (if CORS allows)
const response = await fetch(
  `https://api.airtable.com/v0/${baseId}/${tableId}`,
  {
    headers: {
      Authorization: `Bearer ${credential.value}`,
    },
  }
);

// Option 2: Gateway proxy (for security or if CORS blocked)
const response = await fetch(
  `${gatewayUrl}/api/proxy/airtable/v0/${baseId}/${tableId}?credential_id=${credential.id}`
);
```

---

## Data Flow Examples

### Adding a Credential

```
1. User → Frontend: Opens credential management UI
2. Frontend → Ganymede: POST /api/credentials
   Body: { type: 'notion_api_key', name: 'My Notion Key', value: 'secret_xxx' }
3. Ganymede:
   - Validates credential type schema
   - Encrypts value with AES-256-GCM
   - Stores in database
   - Returns credential summary (without decrypted value)
4. Frontend: Updates UI with new credential
```

### Using a Credential in Frontend Module (Direct Call)

```
1. User → Frontend: Creates chat node
2. Module → Frontend: Prompts for credential (API key or OAuth)
3. User → Frontend: Provides credential (enters API key or completes OAuth)
4. Frontend → Ganymede: POST /api/credentials
   { type: 'slack_token', name: 'My Slack Token', value: 'xoxb-...' }
5. Ganymede: Encrypts and stores credential
6. Frontend → Gateway: Event 'slack-chat:create-node'
   { conversation_id: 'C123' }
7. Gateway reducer:
   - Stores conversation_id in shared state
   - NO credential reference stored
8. Gateway → All clients: State update via Yjs (conversation_id only)
9. Each user's Frontend:
   - Reads shared state (conversation_id)
   - Fetches their own credential from Ganymede: GET /api/credentials?type=slack_token
   - Ganymede validates access (user owns or has share access)
   - Ganymede decrypts and returns credential
   - Frontend makes direct API call to third-party service
   - Only users with proper permissions see the data
```

### Using a Credential via Gateway Proxy

```
1-8. Same as above (credential stored, conversation_id in shared state)
9. Each user's Frontend:
   - Reads shared state (conversation_id)
   - Fetches their own credential ID from Ganymede: GET /api/credentials?type=notion_api_key
   - Makes request to Gateway proxy: GET /api/proxy/notion/v1/databases/{id}?credential_id={cred_id}
10. Gateway Proxy:
    - Validates user has access to credential
    - Fetches credential from Ganymede: GET /api/credentials/{cred_id}
    - Ganymede decrypts and returns credential
    - Gateway replaces credential_id with actual token/key
    - Gateway forwards request to third-party API with credential
    - Returns response to frontend
11. Frontend: Receives data (credential never exposed to frontend)
```

### When to Use Proxy vs Direct Calls

**Use Gateway Proxy When:**

- Third-party API blocks CORS requests from browsers
- API keys must not be exposed to frontend code (security requirement)
- Rate limiting is based on server IP rather than client IP
- API requires server-side authentication flow
- You want to add additional security layers (request validation, rate limiting, etc.)

**Use Direct Frontend Calls When:**

- Third-party API supports CORS and allows browser requests
- OAuth tokens are acceptable to use in frontend (short-lived tokens)
- You want to reduce server load
- API is designed for client-side usage
- Real-time features require direct WebSocket connections

### Sharing a Credential

```
1. User → Frontend: Opens credential sharing UI
2. Frontend → Ganymede: POST /api/credentials/{id}/share
   Body: { share_scope: 'project', project_id: 'proj-123' }
3. Ganymede:
   - Validates user owns credential
   - Creates share record in credential_shares table
   - Returns share confirmation
4. Frontend: Updates UI showing share status
5. Project members can now use this credential in their frontend
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

- [ ] Database schema (Ganymede)
- [ ] Encryption service (Ganymede)
- [ ] CRUD API endpoints (Ganymede)
- [ ] Basic frontend UI (list, add, edit, delete)

### Phase 2: Frontend Integration

- [ ] Frontend credential hooks (useQueryCredential, etc.)
- [ ] Credential selector UI components
- [ ] Integration with one module (chat or Notion)
- [ ] Direct API call patterns in frontend

### Phase 3: Module Integration

- [ ] Module credential provider registration system
- [ ] Notion module integration (frontend credential usage)
- [ ] Airtable module integration (frontend credential usage)
- [ ] Chat module integration (example pattern)
- [ ] OAuth flow handling for modules

### Phase 4: Gateway API Proxy

- [ ] Gateway proxy endpoint implementation
- [ ] Credential retrieval from Ganymede in proxy
- [ ] Request forwarding to third-party APIs
- [ ] Security validation (user access checks)
- [ ] Error handling and rate limiting
- [ ] Integration with modules that need proxy

### Phase 5: Advanced Features

- [ ] Credential validation/testing
- [ ] Credential sharing (organization/project/resource levels)
- [ ] Credential expiry management
- [ ] Audit logging
- [ ] Key rotation support
- [ ] Credential usage analytics

---

## Key Design Decisions

### Frontend-First Architecture

**Decision:** Credentials are primarily used in frontend, not gateway reducers.

**Rationale:**

- **Permission Enforcement**: Each user fetches their own data, respecting third-party service permissions
- **Security**: Prevents unauthorized data exposure that could occur with server-side fetching
- **Privacy**: Users only see data they have access to in the third-party service

**Trade-offs:**

- More API calls from frontend (but necessary for security)
- Credentials must be decrypted in frontend (mitigated by HTTPS and secure storage)

### Granular Sharing Model

**Decision:** Support organization, project, and resource-level credential sharing.

**Rationale:**

- **Flexibility**: Users can share credentials at the appropriate scope
- **Security**: Fine-grained control over who can use credentials
- **Use Cases**:
  - Organization: Share company API keys with all team members
  - Project: Share project-specific credentials
  - Resource: Share credentials for specific nodes/components

### Shared State Pattern

**Decision:** Do NOT store credential references in shared state. Each user uses their own credentials.

**Rationale:**

- Credentials are user-specific and should not be in collaborative state
- Each user should use their own credentials to respect third-party permissions
- Shared credentials are accessed via sharing mechanism, not through shared state references
- Modules can prompt users for credentials when needed

## Open Questions

1. **Credential Types:**

   - How to handle credential type registration when modules are loaded/unloaded?
   - Should credential metadata be cached or fetched on-demand?

2. **Credential Rotation:**

   - How to handle expired/rotated credentials?
   - Should there be automatic validation and notifications?

3. **Container Integration:**

   - How to inject credentials into user containers, is it needed?
   - Should containers use shared credentials or user-specific credentials?

4. **Credential Caching:**

   - Should credentials be cached in frontend? For how long?
   - How to handle cache invalidation on credential updates?

5. **Revocation:**
   - How to handle credential revocation in real-time?
   - Should revoked credentials immediately stop working in active sessions?
