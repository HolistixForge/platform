# Credentials Wallet Architecture

> **Status**: v1 Implementation  
> **Issue**: [#4 - feat: Credentials Wallet for Third-Party API Integration](https://github.com/HolistixForge/platform/issues/4)  
> **Last Updated**: January 2026

## Table of Contents

1. [Overview](#overview)
2. [User Features](#user-features)
3. [Security Model](#security-model)
4. [Architecture](#architecture)
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

### Chosen Model: Master Key Encryption

**Decision**: Use a server-side master key stored in environment variables.

**Justification**:

- Protects against database dumps (key is not in DB)
- Supports all use cases (background jobs, OAuth users)
- Simple to implement and operate
- Accepted trade-off: master key compromise exposes all credentials

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
- **Salt**: Random 32 bytes per encryption operation

---

## Architecture

### Single Source of Truth: Ganymede

All credential management is centralized in Ganymede:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CREDENTIAL ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Frontend                      Ganymede                                 │
│   ┌──────┐                     ┌──────────────────────────────┐         │
│   │      │─────────────────────│  /api/credentials/*          │         │
│   │      │  All credential     │  - CRUD operations           │         │
│   │      │  API calls          │  - Sharing/assignment        │         │
│   │      │                     │  - Type listing              │         │
│   │      │                     │  - Validation                │         │
│   │      │                     │                              │         │
│   │      │                     │  credentials-encryption.ts   │         │
│   │      │                     │  - AES-256-GCM encrypt       │         │
│   │      │                     │  - Master key from env       │         │
│   └──────┘                     └──────────────────────────────┘         │
│                                                                          │
│   Gateway                                                                │
│   ┌──────┐                                                               │
│   │      │  ❌ No credential routes                                     │
│   │      │  ❌ No credential encryption                                 │
│   │      │  ❌ No CredentialManager                                     │
│   │      │                                                               │
│   │      │  ✅ Can call Ganymede to get credentials                     │
│   │      │     for proxy operations (future)                            │
│   └──────┘                                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Credential Providers as Database Seed Data

Credential providers (types) are defined in database schema, not registered by modules at runtime:

**Justification**:

- **Prevents duplication**: Multiple deployments won't create duplicate providers
- **Versioning**: Provider definitions can be updated via database migrations
- **Cross-module usage**: Different modules can use the same credential type
- **Simplicity**: No complex registration lifecycle or conflict resolution

---

## Implementation

### Package Structure

```
packages/
├── app-ganymede/                        # ALL CREDENTIAL LOGIC
│   ├── src/
│   │   ├── routes/credentials/
│   │   │   └── index.ts                 # CRUD, sharing, types API
│   │   └── services/
│   │       └── credentials-encryption.ts # AES-256-GCM implementation
│   └── database/schema/
│       └── 02-schema.sql                # Tables + seed data
│
├── frontend-data/
│   └── src/lib/
│       └── credentials-queries.ts       # React Query hooks
│
├── ui-base/
│   └── src/lib/credentials/
│       ├── CredentialCard.tsx
│       ├── CredentialForm.tsx
│       ├── CredentialsList.tsx
│       └── CredentialTypeSelector.tsx
│
└── types/
    └── src/lib/ganymede-api/
        └── credentials.ts               # TypeScript types
```

### Database Schema

```sql
-- Provider metadata (seed data)
CREATE TABLE public.credential_metadata (
    credential_type VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(512),
    required_fields JSONB DEFAULT '[]',
    module_name VARCHAR(100) NOT NULL
);

-- Seed default providers
INSERT INTO public.credential_metadata VALUES
  ('openai_api_key', 'OpenAI API Key', 'API key for OpenAI services', '["api_key"]', 'ai'),
  ('anthropic_api_key', 'Anthropic API Key', 'API key for Claude models', '["api_key"]', 'ai'),
  ('github_token', 'GitHub Token', 'Personal access token', '["token"]', 'vcs'),
  ('notion_api_key', 'Notion API Key', 'Integration token', '["api_key"]', 'productivity'),
  ('generic_api_key', 'Generic API Key', 'Generic API key', '["api_key"]', 'generic')
ON CONFLICT (credential_type) DO NOTHING;

-- User credentials (encrypted)
CREATE TABLE public.credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    credential_type VARCHAR(100) NOT NULL REFERENCES credential_metadata(credential_type),
    name VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    encryption_key_id VARCHAR(50) NOT NULL DEFAULT 'v1',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Sharing configuration
CREATE TABLE public.credential_shares (
    share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES credentials(credential_id) ON DELETE CASCADE,
    share_scope VARCHAR(50) NOT NULL,
    organization_id UUID REFERENCES organizations(organization_id),
    project_id UUID REFERENCES projects(project_id),
    resource_id UUID,
    granted_by UUID NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

---

## API Reference

### Ganymede API

| Method         | Endpoint                                | Description                           |
| -------------- | --------------------------------------- | ------------------------------------- |
| **Types**      |                                         |                                       |
| GET            | `/api/credentials/types`                | List available credential providers   |
| **CRUD**       |                                         |                                       |
| GET            | `/api/credentials`                      | List user's credentials               |
| GET            | `/api/credentials/:id`                  | Get credential (with decrypted value) |
| POST           | `/api/credentials`                      | Create new credential                 |
| PATCH          | `/api/credentials/:id`                  | Update credential                     |
| DELETE         | `/api/credentials/:id`                  | Delete credential (soft delete)       |
| **Sharing**    |                                         |                                       |
| GET            | `/api/credentials/:id/shares`           | List shares for a credential          |
| POST           | `/api/credentials/:id/share`            | Assign credential to org/project      |
| DELETE         | `/api/credentials/:id/shares/:share_id` | Revoke assignment                     |
| **Validation** |                                         |                                       |
| POST           | `/api/credentials/:id/validate`         | Test if credential is valid           |

---

## Credential Usage Flows

### Flow 1: Frontend Direct API Call

For services where the frontend needs to make direct API calls:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  FRONTEND DIRECT CALL                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Frontend                      Ganymede                 Third-Party     │
│   ┌──────┐                     ┌──────┐                 ┌──────┐        │
│   │  1.  │─────────────────────│      │                 │      │        │
│   │      │  GET /credentials/  │  2.  │                 │      │        │
│   │      │  :id                │ DECRYPT                │      │        │
│   │      │◄────────────────────│      │                 │      │        │
│   │      │  { value: "sk-..." }│      │                 │      │        │
│   │      │                     │      │                 │      │        │
│   │  3.  │─────────────────────────────────────────────│      │        │
│   │      │  Direct API call with credential            │      │        │
│   │      │◄────────────────────────────────────────────│      │        │
│   │      │  { data: [...] }                            │      │        │
│   └──────┘                     └──────┘                 └──────┘        │
│                                                                          │
│   Use case: Each user sees data according to their Notion permissions   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Background Job

For scheduled tasks that operate on behalf of users:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  BACKGROUND JOB                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Cron Job              Ganymede                      Third-Party        │
│   ┌──────┐             ┌──────┐                      ┌──────┐           │
│   │  1.  │─────────────│      │                      │      │           │
│   │      │ Get users   │      │                      │      │           │
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
│   └──────┘             └──────┘                      └──────┘           │
│                                                                          │
│   Use case: Nightly sync of user's Notion data                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Future Improvements

### v2: Gateway Proxy Route

Add a proxy route in Gateway that injects credentials server-side, for cases where:

- CORS prevents direct frontend calls
- We don't want to expose credentials to the frontend

```typescript
// POST /api/proxy/:service
// Gateway fetches credential from Ganymede, injects it, and forwards request
```

### v2: Hybrid Security Model

Add optional per-user encryption for high-security credentials:

```sql
ALTER TABLE public.credentials
ADD COLUMN security_level VARCHAR(20) DEFAULT 'standard';
-- 'standard' = master key (background jobs work)
-- 'high' = password-derived (session-only, true isolation)
```

### v2: Hardware Security Module Integration

For enterprise deployments, integrate with external KMS:

- HashiCorp Vault
- AWS Key Management Service
- Azure Key Vault

### v2: Credential Rotation

Automated OAuth token refresh and credential rotation.

### v2: Audit Logging

Track credential usage for compliance:

```sql
CREATE TABLE public.credential_audit_log (
    id UUID PRIMARY KEY,
    credential_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Summary

The Credentials Wallet v1 implements a **practical architecture** that:

1. ✅ Centralizes all credential logic in Ganymede
2. ✅ Protects credentials from database dumps
3. ✅ Supports all use cases (API keys, background jobs)
4. ✅ Enables flexible assignment at org/project/resource level
5. ⚠️ Accepts the trade-off that master key compromise affects all users

Future versions can add per-user isolation, KMS integration, and a Gateway proxy route for enhanced security.
