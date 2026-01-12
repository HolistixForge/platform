# Credentials Wallet Architecture

> **Status**: v1 Implementation  
> **Issue**: [#4 - feat: Credentials Wallet for Third-Party API Integration](https://github.com/HolistixForge/platform/issues/4)  
> **Last Updated**: January 2026

## Table of Contents

1. [Overview](#overview)
2. [Goals & Requirements](#goals--requirements)
3. [Security Model](#security-model)
4. [Architecture Decisions](#architecture-decisions)
5. [Implementation](#implementation)
6. [API Reference](#api-reference)
7. [Future Improvements](#future-improvements)

---

## Overview

The Credentials Wallet is a secure storage system for third-party API credentials (API keys, OAuth tokens) that enables:

- **Users** to store and manage their API credentials in one place
- **Modules** to access third-party services on behalf of users
- **Gateway** to proxy requests to third-party APIs without exposing credentials to the frontend

### Core Use Cases

1. **AI Integrations**: Store OpenAI, Anthropic, etc. API keys
2. **Version Control**: GitHub, GitLab personal access tokens
3. **Productivity Tools**: Notion, Airtable API keys or OAuth connections
4. **Cloud Services**: AWS, Google Cloud credentials
5. **Communication**: Slack, Discord bot tokens

---

## Goals & Requirements

### What We Wanted to Achieve

| Goal                                                        | Priority | Status                           |
| ----------------------------------------------------------- | -------- | -------------------------------- |
| Secure credential storage (encrypted at rest)               | P0       | ✅ Achieved                      |
| Database dump protection (credentials unusable without key) | P0       | ✅ Achieved                      |
| Support for API keys and OAuth flows                        | P0       | ✅ Achieved                      |
| Credential sharing at org/project/resource level            | P1       | ✅ Achieved                      |
| Background job support (cron, webhooks)                     | P1       | ✅ Achieved                      |
| Per-user encryption isolation                               | P2       | ⏳ Deferred (see Security Model) |
| Frontend-first credential usage (Gateway proxy)             | P1       | ✅ Achieved                      |

### Non-Goals (v1)

- End-to-end encryption (would break background jobs)
- Hardware Security Module (HSM) integration
- Multi-region key management
- Credential rotation automation

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
| **Network sniffing**       | ✅ Protected - HTTPS + credentials never sent to frontend |
| **Master key compromise**  | ⚠️ All credentials exposed (accepted trade-off)           |
| **Single user compromise** | ⚠️ Only that user's credentials (no cross-user isolation) |

### Key Management

- **Key Storage**: Environment variable `CREDENTIALS_ENCRYPTION_KEY`
- **Key Rotation**: Supported via `encryption_key_id` column (version identifier)
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Salt**: Random 32 bytes per encryption operation (prevents identical plaintext → identical ciphertext)

---

## Architecture Decisions

### Decision 1: Encryption Responsibility

**Decision**: Ganymede is the single source of encryption/decryption.

**Justification**:

- Ganymede owns the database and credential storage
- Gateway acts as a proxy, never handles raw credentials
- Prevents code duplication and divergent encryption implementations
- Clear separation of concerns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CREDENTIAL FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Frontend                Gateway                    Ganymede            │
│   ┌──────┐               ┌──────┐                   ┌──────┐            │
│   │      │───────────────│      │───────────────────│      │            │
│   │      │  "Store my    │      │  Forward with     │      │            │
│   │      │  API key"     │      │  user context     │      │            │
│   │      │               │      │                   │      │            │
│   │      │               │      │                   │ ENCRYPT           │
│   │      │               │      │                   │ & STORE           │
│   │      │               │      │                   │      │            │
│   └──────┘               └──────┘                   └──────┘            │
│                                                                          │
│   Frontend                Gateway                    Ganymede            │
│   ┌──────┐               ┌──────┐                   ┌──────┐            │
│   │      │───────────────│      │───────────────────│      │            │
│   │      │  "Call        │      │  "Get credential  │      │            │
│   │      │  Notion API"  │      │   for user X"     │ DECRYPT           │
│   │      │               │      │◄──────────────────│      │            │
│   │      │               │      │  (decrypted)      │      │            │
│   │      │               │ CALL │                   │      │            │
│   │      │               │ API  │                   │      │            │
│   │      │◄──────────────│      │                   │      │            │
│   │      │  (result)     │      │                   │      │            │
│   └──────┘               └──────┘                   └──────┘            │
│                                                                          │
│   ⚠️ Decrypted credentials NEVER reach the frontend                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Decision 2: Credential Provider Definitions

**Decision**: Credential providers are defined as database seed data, not registered by modules at runtime.

**Justification**:

- **Prevents duplication**: Multiple module instances won't create duplicate providers
- **Versioning**: Provider definitions can be updated via database migrations
- **Cross-module usage**: Different modules can use the same credential type (e.g., multiple modules using Notion API)
- **Simplicity**: No complex registration lifecycle or conflict resolution

**Implementation**:

```sql
-- Credential types defined in database schema
INSERT INTO public.credential_metadata
  (credential_type, display_name, description, required_fields, module_name)
VALUES
  ('openai_api_key', 'OpenAI API Key', 'API key for OpenAI services', '["api_key"]', 'ai'),
  ('notion_api_key', 'Notion API Key', 'Integration token for Notion', '["api_key"]', 'productivity'),
  -- ... more providers
ON CONFLICT (credential_type) DO NOTHING;
```

### Decision 3: Credential Sharing Model

**Decision**: Hierarchical sharing at organization, project, and resource levels.

**Justification**:

- **Organization level**: Admin shares API key for entire company
- **Project level**: Team lead shares key for specific project
- **Resource level**: User shares key for specific resource (e.g., a specific Notion database)

```sql
CREATE TABLE public.credential_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id uuid NOT NULL REFERENCES credentials(id),
    share_scope VARCHAR(50) NOT NULL, -- 'organization', 'project', 'resource'
    organization_id uuid REFERENCES organizations(organization_id),
    project_id uuid REFERENCES projects(project_id),
    resource_id VARCHAR(255), -- For resource-level sharing
    granted_by uuid NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

### Decision 4: OAuth vs API Key Support

**Decision**: Support both collection methods with unified storage.

**Justification**:

- Some services only offer OAuth (Google, Microsoft)
- Some services only offer API keys (OpenAI)
- Some offer both (Notion, GitHub)
- Unified storage simplifies credential management

```typescript
type TCredentialCollectionMethod = 'api_key' | 'oauth';

type TCredentialProvider = {
  id: string;
  displayName: string;
  description: string;
  category: string;
  collectionMethod: TCredentialCollectionMethod;
  // OAuth-specific config (when method is 'oauth')
  oauthConfig?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
  };
  // API key validation schema (when method is 'api_key')
  validationSchema?: Record<string, unknown>;
};
```

---

## Implementation

### Package Structure

```
packages/
├── app-ganymede/
│   ├── src/
│   │   ├── routes/credentials/     # REST API endpoints
│   │   │   └── index.ts
│   │   └── services/
│   │       └── credentials-encryption.ts  # AES-256-GCM implementation
│   └── database/schema/
│       └── 02-schema.sql           # credentials, credential_shares, credential_metadata
│
├── app-gateway/
│   └── src/
│       ├── credentials/
│       │   ├── CredentialManager.ts    # Orchestrates credential operations
│       │   ├── providers.ts            # Provider definitions (runtime reference)
│       │   └── index.ts
│       └── routes/
│           └── credentials.ts          # Gateway credential routes
│
├── modules/gateway/
│   └── src/lib/
│       ├── credential-provider-types.ts    # Type definitions
│       ├── credential-provider-registry.ts # In-memory provider registry
│       └── managers.ts                     # CredentialManager abstract class
│
├── frontend-data/
│   └── src/lib/
│       └── credentials-queries.ts      # React Query hooks
│
└── ui-base/
    └── src/lib/credentials/
        ├── CredentialCard.tsx
        ├── CredentialForm.tsx
        ├── CredentialsList.tsx
        ├── CredentialTypeSelector.tsx
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

-- Sharing configuration
CREATE TABLE public.credential_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id uuid NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    share_scope VARCHAR(50) NOT NULL,
    organization_id uuid REFERENCES organizations(organization_id),
    project_id uuid REFERENCES projects(project_id),
    resource_id VARCHAR(255),
    granted_by uuid NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Provider metadata (seed data)
CREATE TABLE public.credential_metadata (
    credential_type VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(512),
    validation_schema JSONB,
    required_fields JSONB,
    encryption_required BOOLEAN DEFAULT true,
    module_name VARCHAR(100)
);
```

### Key Components

#### Ganymede: Encryption Service

```typescript
// packages/app-ganymede/src/services/credentials-encryption.ts
export function encryptCredential(
  plaintext: string,
  keyVersion: string
): string {
  const masterKey = getMasterKey(keyVersion);
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

export function decryptCredential(
  encryptedValue: string,
  keyVersion: string
): string {
  const masterKey = getMasterKey(keyVersion);
  const combined = Buffer.from(encryptedValue, 'base64');
  // Extract salt, iv, authTag, ciphertext and decrypt
  // ...
}
```

#### Gateway: Credential Manager

```typescript
// packages/app-gateway/src/credentials/CredentialManager.ts
export class CredentialManagerImpl extends CredentialManager {
  constructor(
    private ganymedeClient: GanymedeClient,
    private providerRegistry: CredentialProviderRegistry,
    private organizationId: string,
    private gatewayId: string
  ) {
    super();
  }

  async createApiKeyCredential(
    request: TCreateApiKeyCredentialRequest
  ): Promise<TStoredCredential> {
    // Validate against provider schema
    // Forward to Ganymede for storage (Ganymede handles encryption)
    return this.ganymedeClient.post('/api/credentials', request);
  }

  async useCredential(credentialId: string): Promise<TDecryptedCredential> {
    // Get decrypted credential from Ganymede
    // Update last_used_at
    // Return for Gateway to use in API calls
  }
}
```

---

## API Reference

### Ganymede API (Internal)

| Method | Endpoint                               | Description                        |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/api/credentials`                     | List user's credentials            |
| GET    | `/api/credentials/:id`                 | Get credential details (decrypted) |
| POST   | `/api/credentials`                     | Create new credential              |
| PATCH  | `/api/credentials/:id`                 | Update credential                  |
| DELETE | `/api/credentials/:id`                 | Delete credential                  |
| GET    | `/api/credentials/types`               | List available credential types    |
| POST   | `/api/credentials/:id/shares`          | Share credential                   |
| DELETE | `/api/credentials/:id/shares/:shareId` | Revoke share                       |

### Gateway API (Frontend-facing)

| Method | Endpoint                             | Description                       |
| ------ | ------------------------------------ | --------------------------------- |
| GET    | `/credentials/providers`             | List available providers          |
| GET    | `/credentials`                       | List user's credentials (summary) |
| POST   | `/credentials/api-key`               | Store API key credential          |
| GET    | `/credentials/oauth/start/:provider` | Start OAuth flow                  |
| GET    | `/credentials/oauth/callback`        | OAuth callback                    |
| POST   | `/credentials/:id/use`               | Use credential (internal)         |
| DELETE | `/credentials/:id`                   | Delete credential                 |

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

For enterprise deployments:

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
// - AzureKeyVault (Azure)
```

### v2: Credential Rotation

Automated credential refresh for OAuth tokens:

```typescript
interface CredentialRotationPolicy {
  credentialId: string;
  rotationInterval: Duration;
  lastRotated: Date;
  nextRotation: Date;
}

// Background job to refresh expiring OAuth tokens
async function rotateExpiringCredentials() {
  const expiring = await getCredentialsExpiringWithin('24h');
  for (const cred of expiring) {
    if (cred.type === 'oauth') {
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

### v3: Zero-Knowledge Architecture

For maximum security (significant complexity):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Client-Side Encryption                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Browser                              Server                             │
│  ┌──────────────────────┐            ┌──────────────────────────────┐  │
│  │ 1. Derive key from   │            │                              │  │
│  │    user password     │            │  Only stores encrypted blob  │  │
│  │                      │            │  Server CANNOT decrypt       │  │
│  │ 2. Encrypt credential│────────────│                              │  │
│  │    in browser        │            │  For API calls:              │  │
│  │                      │            │  - User sends encrypted cred │  │
│  │ 3. Send encrypted    │            │  - Server decrypts in memory │  │
│  │    blob to server    │            │  - Makes API call            │  │
│  └──────────────────────┘            │  - Forgets key immediately   │  │
│                                       └──────────────────────────────┘  │
│                                                                          │
│  Trade-off: No background jobs possible, complex key management          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The Credentials Wallet v1 implements a **practical security model** that:

1. ✅ Protects credentials from database dumps
2. ✅ Supports all required use cases (API keys, OAuth, background jobs)
3. ✅ Provides clear separation of concerns (Ganymede = storage, Gateway = proxy)
4. ✅ Enables flexible sharing at multiple levels
5. ⚠️ Accepts the trade-off that master key compromise affects all users

Future versions can add per-user isolation for users who need maximum security and are willing to accept the session-only limitation.
