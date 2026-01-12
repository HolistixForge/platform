# Credentials Wallet Architecture

> **Status**: v1 Implementation (In Progress)  
> **Issue**: [#4 - feat: Credentials Wallet for Third-Party API Integration](https://github.com/HolistixForge/platform/issues/4)  
> **Last Updated**: January 2026

## Table of Contents

1. [Overview](#overview)
2. [User Features](#user-features)
3. [Security Model](#security-model)
4. [Architecture Decisions](#architecture-decisions)
5. [Implementation](#implementation)
6. [API Reference](#api-reference)
7. [Credential Usage Flows](#credential-usage-flows)
8. [Future Improvements](#future-improvements)

---

## Overview

### Why a Credentials Wallet?

Modern productivity platforms integrate with many third-party services (Notion, GitHub, OpenAI, etc.). Each user needs to store their own API credentials to:

1. **Access their personal data** from third-party services
2. **Maintain their permissions** - using their own tokens means their access level is respected
3. **Not share sensitive credentials** - each user owns their own keys
4. **Enable background operations** - scheduled tasks can act on behalf of users

Without a credentials wallet, users would need to:

- Re-enter credentials every time they use an integration
- Share organization-level keys (security risk)
- Lose access to features requiring third-party APIs

### Core Capabilities

The Credentials Wallet enables:

- **Users** to securely store and manage their API credentials in one place
- **Users** to assign credentials for use within specific organizations or projects
- **Modules** to access third-party services on behalf of users
- **Gateway** to proxy requests to third-party APIs, injecting credentials server-side

### Supported Credential Types

| Category        | Examples                  | Collection Method         |
| --------------- | ------------------------- | ------------------------- |
| AI Services     | OpenAI, Anthropic, Cohere | API Key                   |
| Version Control | GitHub, GitLab            | Personal Access Token     |
| Productivity    | Notion, Airtable          | API Key or OAuth          |
| Cloud Services  | AWS, Google Cloud         | API Key / Service Account |
| Communication   | Slack, Discord            | Bot Token or OAuth        |

---

## User Features

### 1. Credential Storage

Users can store credentials with:

- **Name**: User-defined label (e.g., "My OpenAI Key", "Work Notion")
- **Type**: Selected from available providers
- **Value**: The actual API key/token (encrypted at rest)
- **Metadata**: Optional notes or configuration

### 2. Credential Assignment (Sharing)

Users can assign their credentials to be used from specific contexts:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREDENTIAL ASSIGNMENT MODEL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User's Credential: "My Notion API Key"                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Assigned to Organization: "Acme Corp"                          │    │
│  │  → All org members can use this credential in org context       │    │
│  │  → User still owns it, can revoke anytime                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Assigned to Project: "Q1 Marketing"                            │    │
│  │  → Only project members can use this credential                 │    │
│  │  → Scoped to specific project work                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Assigned to Resource: "Product Roadmap Board"                  │    │
│  │  → Only usable for this specific resource                       │    │
│  │  → Maximum access control granularity                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Credential Management UI

The frontend provides:

- **Wallet page** (`/account/credentials`): List all user's credentials
- **Add credential form**: Select provider type, enter name and value
- **Assignment panel**: Assign credentials to orgs/projects
- **Revoke/Delete**: Remove assignments or delete credentials entirely

---

## Security Model

### The Fundamental Trade-off

We explored several encryption strategies and discovered a fundamental trade-off:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SECURITY vs FUNCTIONALITY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Per-User Encryption (password-derived)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ✅ Database dump: Only hashes, no credentials                       ││
│  │ ✅ User isolation: One user compromised ≠ all users compromised     ││
│  │ ❌ Background jobs: Cannot work (no password in cron context)       ││
│  │ ❌ OAuth users: Need to set a separate password                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  Master Key Encryption (server-side)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ✅ Database dump: Credentials encrypted, key not in DB              ││
│  │ ❌ User isolation: Master key compromise = all credentials exposed  ││
│  │ ✅ Background jobs: Work (server has master key)                    ││
│  │ ✅ OAuth users: Work seamlessly                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Solutions Explored

| Approach                           | Description                                    | Why Rejected/Accepted                                              |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **Per-user password-derived keys** | Derive encryption key from user's password     | ❌ Breaks background jobs, OAuth users need separate password      |
| **Per-user salts with master key** | Unique salt per user, combined with master key | ❌ Security theater - salt adds no protection if master key leaked |
| **Hardware Security Module (KMS)** | External key management (Vault, AWS KMS)       | ⏳ Deferred - adds operational complexity for v1                   |
| **Master key in environment**      | Single encryption key stored outside database  | ✅ Accepted - simple, effective, supports all use cases            |

### Chosen Model: Master Key Encryption

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ENCRYPTION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Environment Variable              Database (PostgreSQL)                │
│   ┌──────────────────────┐         ┌─────────────────────────────────┐  │
│   │ CREDENTIALS_         │         │ credentials                     │  │
│   │ ENCRYPTION_KEY       │         │ ├─ id                           │  │
│   │ (32 bytes, secure)   │         │ ├─ user_id                      │  │
│   │                      │         │ ├─ credential_type              │  │
│   │ NOT IN DATABASE      │         │ ├─ encrypted_value ◄── AES-256  │  │
│   └──────────┬───────────┘         │ ├─ encryption_key_id (version)  │  │
│              │                      │ └─ metadata                     │  │
│              │                      └─────────────────────────────────┘  │
│              │                                                           │
│              ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    Ganymede Service                               │  │
│   │                                                                    │  │
│   │  encrypt(plaintext) {                                             │  │
│   │    salt = random(32 bytes)                                        │  │
│   │    iv = random(16 bytes)                                          │  │
│   │    key = PBKDF2(MASTER_KEY, salt, 100000, 'sha256')              │  │
│   │    encrypted = AES-256-GCM(plaintext, key, iv)                   │  │
│   │    return base64(salt + iv + authTag + encrypted)                │  │
│   │  }                                                                 │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Properties

| Threat Model               | Protection                                                |
| -------------------------- | --------------------------------------------------------- |
| **Database dump**          | ✅ Protected - encryption key not in database             |
| **SQL injection**          | ✅ Protected - credentials encrypted at rest              |
| **Network sniffing**       | ✅ Protected - HTTPS throughout                           |
| **Master key compromise**  | ⚠️ All credentials exposed (accepted trade-off)           |
| **Single user compromise** | ⚠️ Only that user's credentials (no cross-user isolation) |

### Key Management

- **Key Storage**: Environment variable `CREDENTIALS_ENCRYPTION_KEY`
- **Key Rotation**: Supported via `encryption_key_id` column (version identifier)
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Salt**: Random 32 bytes per encryption operation (prevents identical plaintext → identical ciphertext)

---

## Architecture Decisions

### Decision 1: Ganymede as Single Source

**Decision**: All credential management (storage, encryption, OAuth, API) is in Ganymede.

**Justification**:

- Ganymede owns the database and user authentication
- Single source of truth prevents code duplication
- Encryption happens where data is stored
- Clear responsibility: Ganymede = credential management

**What Gateway does NOT have**:

- ❌ No credential API routes in Gateway
- ❌ No credential encryption in Gateway
- ❌ No CredentialManager class in Gateway
- ❌ No OAuth callback handling in Gateway

**What Gateway HAS**:

- ✅ A thin client to fetch credentials from Ganymede (for use in reducers/proxying)
- ✅ Proxy routes to call third-party APIs with injected credentials

### Decision 2: Credential Providers as Database Seed Data

**Decision**: Credential providers (types) are defined as database seed data, not registered by modules at runtime.

**Justification**:

- **Prevents duplication**: Multiple deployments won't create duplicate providers
- **Versioning**: Provider definitions can be updated via database migrations
- **Cross-module usage**: Different modules can use the same credential type
- **Simplicity**: No complex registration lifecycle or conflict resolution
- **Predictability**: Providers are known at deployment time

**Implementation**:

```sql
-- Credential types seeded in database schema
INSERT INTO public.credential_metadata
  (credential_type, display_name, description, collection_method, required_fields, oauth_config)
VALUES
  ('openai_api_key', 'OpenAI API Key', 'API key for OpenAI services', 'api_key', '["api_key"]', NULL),
  ('notion_api_key', 'Notion API Key', 'Integration token for Notion', 'api_key', '["api_key"]', NULL),
  ('notion_oauth', 'Notion (OAuth)', 'Connect via Notion OAuth', 'oauth', NULL, '{"authorization_url": "...", "token_url": "...", "scopes": [...]}'),
  -- ... more providers
ON CONFLICT (credential_type) DO NOTHING;
```

### Decision 3: Credential Sharing Model

**Decision**: Hierarchical assignment at organization, project, and resource levels.

**Justification**:

- **Organization level**: Admin shares API key for entire company
- **Project level**: Team lead shares key for specific project
- **Resource level**: User shares key for specific resource (e.g., a specific Notion database)

### Decision 4: OAuth vs API Key Support

**Decision**: Support both collection methods with unified storage.

**Justification**:

- Some services only offer OAuth (Google, Microsoft)
- Some services only offer API keys (OpenAI)
- Some offer both (Notion, GitHub)
- Unified storage simplifies credential management

---

## Implementation

### Package Structure (Target State)

```
packages/
├── app-ganymede/                        # ALL CREDENTIAL LOGIC HERE
│   ├── src/
│   │   ├── routes/credentials/          # All credential API routes
│   │   │   └── index.ts                 # CRUD, OAuth, sharing, types
│   │   └── services/
│   │       └── credentials-encryption.ts # AES-256-GCM implementation
│   └── database/schema/
│       └── 02-schema.sql                # credentials, credential_shares, credential_metadata (with seed data)
│
├── app-gateway/                         # MINIMAL CREDENTIAL CODE
│   └── src/
│       ├── lib/
│       │   └── credentials-client.ts    # Thin client to fetch credentials from Ganymede
│       └── routes/
│           └── proxy.ts                 # Proxy route for third-party API calls
│
├── frontend-data/
│   └── src/lib/
│       └── credentials-queries.ts       # React Query hooks (calls Ganymede API)
│
└── ui-base/
    └── src/lib/credentials/
        ├── CredentialCard.tsx
        ├── CredentialForm.tsx
        ├── CredentialsList.tsx
        ├── CredentialTypeSelector.tsx
        ├── CredentialAssignment.tsx     # Assign to org/project UI
        └── credentials.scss
```

### Database Schema

```sql
-- User credentials (encrypted)
CREATE TABLE public.credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    credential_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,           -- AES-256-GCM encrypted
    encryption_key_id VARCHAR(50) NOT NULL,  -- Key version for rotation
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Sharing/Assignment configuration
CREATE TABLE public.credential_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id uuid NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    share_scope VARCHAR(50) NOT NULL,        -- 'organization', 'project', 'resource'
    organization_id uuid REFERENCES organizations(organization_id),
    project_id uuid REFERENCES projects(project_id),
    resource_id VARCHAR(255),
    granted_by uuid NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Provider metadata (seed data - NOT module-registered)
CREATE TABLE public.credential_metadata (
    credential_type VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(512),
    collection_method VARCHAR(20) NOT NULL DEFAULT 'api_key', -- 'api_key' | 'oauth'
    required_fields JSONB,                   -- For API key: ["api_key"] or ["access_key", "secret_key"]
    oauth_config JSONB,                      -- For OAuth: { authorization_url, token_url, scopes, ... }
    category VARCHAR(50),                    -- 'ai', 'vcs', 'productivity', etc.
    encryption_required BOOLEAN NOT NULL DEFAULT true
);

-- Seed default providers
INSERT INTO public.credential_metadata
  (credential_type, display_name, description, collection_method, required_fields, category)
VALUES
  ('openai_api_key', 'OpenAI API Key', 'API key for OpenAI services (GPT, DALL-E)', 'api_key', '["api_key"]', 'ai'),
  ('anthropic_api_key', 'Anthropic API Key', 'API key for Claude models', 'api_key', '["api_key"]', 'ai'),
  ('notion_api_key', 'Notion API Key', 'Internal integration token', 'api_key', '["api_key"]', 'productivity'),
  ('github_token', 'GitHub Token', 'Personal access token', 'api_key', '["token"]', 'vcs'),
  ('airtable_api_key', 'Airtable API Key', 'Personal access token for Airtable', 'api_key', '["api_key"]', 'productivity'),
  ('slack_bot_token', 'Slack Bot Token', 'Bot token for Slack API', 'api_key', '["token"]', 'communication'),
  ('generic_api_key', 'Generic API Key', 'Generic API key for any service', 'api_key', '["api_key"]', 'generic')
ON CONFLICT (credential_type) DO NOTHING;
```

---

## API Reference

### Ganymede API (All Credential Operations)

| Method         | Endpoint                                | Description                                                 |
| -------------- | --------------------------------------- | ----------------------------------------------------------- |
| **Types**      |                                         |                                                             |
| GET            | `/api/credentials/types`                | List available credential providers                         |
| **CRUD**       |                                         |                                                             |
| GET            | `/api/credentials`                      | List user's credentials (+ shared if `include_shared=true`) |
| GET            | `/api/credentials/:id`                  | Get credential details (decrypted value)                    |
| POST           | `/api/credentials`                      | Create new credential                                       |
| PATCH          | `/api/credentials/:id`                  | Update credential (name, value, metadata)                   |
| DELETE         | `/api/credentials/:id`                  | Delete credential (soft delete)                             |
| **Sharing**    |                                         |                                                             |
| GET            | `/api/credentials/:id/shares`           | List shares for a credential                                |
| POST           | `/api/credentials/:id/share`            | Assign credential to org/project/resource                   |
| DELETE         | `/api/credentials/:id/shares/:share_id` | Revoke assignment                                           |
| **OAuth**      |                                         |                                                             |
| GET            | `/api/credentials/oauth/start/:type`    | Start OAuth flow, returns authorization URL                 |
| GET            | `/api/credentials/oauth/callback`       | OAuth callback, exchanges code for tokens                   |
| **Validation** |                                         |                                                             |
| POST           | `/api/credentials/:id/validate`         | Test if credential is valid                                 |

### Gateway API (Minimal - Proxy Only)

| Method | Endpoint              | Description                                                |
| ------ | --------------------- | ---------------------------------------------------------- |
| POST   | `/api/proxy/:service` | Proxy request to third-party API with credential injection |

---

## Credential Usage Flows

### Flow 1: Frontend Direct API Call (Decrypted Credential)

For services where the frontend needs to make direct API calls (e.g., fetching Notion data that should respect user's Notion permissions):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  FRONTEND DIRECT CALL (with decrypted credential)        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Frontend                      Ganymede                 Notion API      │
│   ┌──────┐                     ┌──────┐                 ┌──────┐        │
│   │      │─────────────────────│      │                 │      │        │
│   │  1.  │  GET /credentials/  │      │                 │      │        │
│   │      │  :id                │  2.  │                 │      │        │
│   │      │◄────────────────────│ DECRYPT                │      │        │
│   │      │  { value: "sk-..." }│      │                 │      │        │
│   │      │                     │      │                 │      │        │
│   │  3.  │─────────────────────────────────────────────│      │        │
│   │      │  Direct API call with credential            │      │        │
│   │      │  Authorization: Bearer sk-...               │      │        │
│   │      │◄────────────────────────────────────────────│      │        │
│   │      │  { data: [...] }                            │      │        │
│   └──────┘                     └──────┘                 └──────┘        │
│                                                                          │
│   ⚠️ Credential IS exposed to frontend (user's own credential)          │
│   ✅ User's Notion permissions are respected                            │
│   ✅ Data is fetched per-user, not shared                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Use Case**: Display a Notion table where each user sees data according to their Notion permissions.

### Flow 2: Gateway Proxy (Credential Injected Server-Side)

For services where we don't want to expose credentials to the frontend, or where CORS prevents direct calls:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  GATEWAY PROXY (credential injected server-side)         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Frontend          Gateway            Ganymede          Third-Party     │
│   ┌──────┐         ┌──────┐           ┌──────┐          ┌──────┐        │
│   │      │─────────│      │           │      │          │      │        │
│   │  1.  │ POST    │      │───────────│      │          │      │        │
│   │      │ /proxy/ │  2.  │ GET cred  │  3.  │          │      │        │
│   │      │ notion  │      │ for user  │ DECRYPT         │      │        │
│   │      │ {query} │      │◄──────────│      │          │      │        │
│   │      │         │      │ {value}   │      │          │      │        │
│   │      │         │      │           │      │          │      │        │
│   │      │         │  4.  │───────────────────────────│      │        │
│   │      │         │      │ API call + credential     │      │        │
│   │      │         │      │◄──────────────────────────│      │        │
│   │      │         │      │ { data }                  │      │        │
│   │      │◄────────│  5.  │           │      │          │      │        │
│   │      │ {data}  │      │           │      │          │      │        │
│   └──────┘         └──────┘           └──────┘          └──────┘        │
│                                                                          │
│   ✅ Credential NEVER reaches frontend                                  │
│   ✅ Gateway handles CORS, rate limiting, caching                       │
│   ✅ Can add request/response transformation                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Use Case**: Call OpenAI API from frontend without exposing the API key.

### Flow 3: Background Job (Cron/Webhook)

For scheduled tasks that operate on behalf of users:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  BACKGROUND JOB (no active user session)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Cron Job              Ganymede                      Third-Party        │
│   ┌──────┐             ┌──────┐                      ┌──────┐           │
│   │      │─────────────│      │                      │      │           │
│   │  1.  │ Get users   │      │                      │      │           │
│   │      │ with sync   │      │                      │      │           │
│   │      │◄────────────│      │                      │      │           │
│   │      │             │      │                      │      │           │
│   │  2.  │─────────────│      │                      │      │           │
│   │      │ For each:   │  3.  │                      │      │           │
│   │      │ GET cred    │ DECRYPT                     │      │           │
│   │      │◄────────────│      │                      │      │           │
│   │      │ {value}     │      │                      │      │           │
│   │      │             │      │                      │      │           │
│   │  4.  │───────────────────────────────────────────│      │           │
│   │      │ API call with credential                  │      │           │
│   │      │◄──────────────────────────────────────────│      │           │
│   │      │             │      │                      │      │           │
│   └──────┘             └──────┘                      └──────┘           │
│                                                                          │
│   ✅ Works without active user session                                  │
│   ✅ Master key available to server process                             │
│   ⚠️ This is why per-user encryption (password-derived) doesn't work   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Use Case**: Nightly sync of user's Notion data, scheduled report generation.

---

## Current Implementation Status

### What's Done ✅

- [x] Database schema (credentials, credential_shares, credential_metadata)
- [x] Encryption service in Ganymede (`credentials-encryption.ts`)
- [x] Basic CRUD routes in Ganymede (`/api/credentials/*`)
- [x] Sharing routes in Ganymede
- [x] Frontend page (`/account/credentials`)
- [x] Frontend components (CredentialsList, CredentialForm, CredentialTypeSelector)

### What Needs Refactoring 🔄

Based on architecture decisions, the following code needs to be moved/removed:

| Current Location                                               | Action | Target                            |
| -------------------------------------------------------------- | ------ | --------------------------------- |
| `app-gateway/src/routes/credentials.ts` (519 lines)            | DELETE | Routes should be in Ganymede only |
| `app-gateway/src/credentials/CredentialManager.ts` (511 lines) | DELETE | Not needed, Ganymede handles all  |
| `app-gateway/src/credentials/providers.ts` (285 lines)         | DELETE | Providers are DB seed data        |
| `modules/gateway/src/lib/credential-provider-*.ts`             | DELETE | Not needed                        |
| `modules/gateway/src/lib/managers.ts` (CredentialManager)      | DELETE | Not needed                        |
| OAuth routes in Gateway                                        | MOVE   | To Ganymede                       |

### What Needs Adding ➕

| Component                                              | Description                                    |
| ------------------------------------------------------ | ---------------------------------------------- |
| `app-gateway/src/lib/credentials-client.ts`            | Thin client to fetch credentials from Ganymede |
| `app-gateway/src/routes/proxy.ts`                      | Proxy route for third-party API calls          |
| `app-ganymede/src/routes/credentials/oauth.ts`         | OAuth flow handling                            |
| `ui-base/src/lib/credentials/CredentialAssignment.tsx` | UI for assigning to org/project                |
| OAuth provider seed data                               | Add OAuth configs to credential_metadata       |

---

## Future Improvements

### v2: Hybrid Security Model

Add optional per-user encryption for high-security credentials:

```sql
ALTER TABLE public.credentials
ADD COLUMN security_level VARCHAR(20) DEFAULT 'standard';
-- 'standard' = master key (background jobs work)
-- 'high' = password-derived (session-only, true isolation)
```

Users choose per-credential:

- Standard: Works in cron jobs, webhooks, etc.
- High: Requires active session, maximum protection

### v2: Hardware Security Module Integration

For enterprise deployments, integrate with external KMS:

```typescript
interface KeyManagementService {
  encrypt(plaintext: string, keyId: string): Promise<string>;
  decrypt(ciphertext: string, keyId: string): Promise<string>;
  rotateKey(oldKeyId: string): Promise<string>;
}

// Implementations:
// - LocalKMS (current - env variable)
// - VaultKMS (HashiCorp Vault)
// - AwsKMS (AWS Key Management Service)
```

### v2: Credential Rotation & Refresh

Automated OAuth token refresh and credential rotation:

```typescript
// Background job to refresh expiring OAuth tokens
async function rotateExpiringCredentials() {
  const expiring = await getCredentialsExpiringWithin('24h');
  for (const cred of expiring) {
    if (cred.collection_method === 'oauth') {
      await refreshOAuthToken(cred);
    }
  }
}
```

### v2: Audit Logging

Track credential usage for compliance:

```sql
CREATE TABLE public.credential_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'accessed', 'updated', 'deleted', 'shared'
    ip_address INET,
    user_agent TEXT,
    context JSONB, -- Which module/feature used it
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Summary

The Credentials Wallet v1 implements a **practical architecture** that:

1. ✅ Centralizes all credential logic in Ganymede (single source of truth)
2. ✅ Protects credentials from database dumps (master key not in DB)
3. ✅ Supports all use cases (API keys, OAuth, background jobs)
4. ✅ Enables flexible assignment at org/project/resource level
5. ✅ Allows frontend to use credentials (direct or proxy, depending on use case)
6. ⚠️ Accepts the trade-off that master key compromise affects all users

The Gateway only has a thin client to retrieve credentials for proxy operations - all management is in Ganymede.
