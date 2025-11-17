# API Reference

This document provides an overview of the REST API endpoints. For detailed schemas, see the OpenAPI specifications in the source code.

## Base URLs

- **Ganymede (API):** `https://ganymede.{env}.{domain}`
- **Gateway (Collab):** `https://gateway.{org-id}.{env}.{domain}` (per organization)

## Authentication

All API requests require authentication via session cookies or JWT tokens.

### Authentication Types

#### Session Authentication

Used for web application requests:

```http
Cookie: connect.sid=s%3A...
```

Obtained via login endpoints:

- `POST /auth/local/login`
- `GET /auth/{provider}/callback` (OAuth)
- `POST /auth/totp/verify`
- `GET /auth/magic-link/{token}`

#### JWT Token Types

The system uses different JWT token types for different purposes:

- **`TJwtUser`** (`access_token` / `refresh_token`): User authentication tokens

  - Contains: `user.id`, `user.username`, `client_id`, `scope[]`, optional `project_id`
  - Used for: Human user API access, collaboration events, WebSocket connections

- **`TJwtUserContainer`** (`user_container_token`): Container authentication tokens

  - Contains: `project_id`, `user_container_id`, `scope`
  - Used for: User container server authentication (VPN config, etc.)

- **`TJwtOrganization`** (`organization_token`): Organization-level tokens

  - Contains: `organization_id`, `gateway_id`, `scope`
  - Used for: Gateway-to-Ganymede communication

- **`TJwtGateway`** (`gateway_token`): Gateway-level tokens
  - Contains: `gateway_id`, `scope`
  - Used for: Gateway container authentication

All JWT tokens should be sent in the Authorization header:

```http
Authorization: Bearer eyJhbGc...
```

Or with `token ` prefix for user tokens:

```http
Authorization: token eyJhbGc...
```

## Ganymede API Endpoints

### Authentication

| Method | Endpoint                   | Description                        |
| ------ | -------------------------- | ---------------------------------- |
| `POST` | `/auth/local/signup`       | Create account with email/password |
| `POST` | `/auth/local/login`        | Login with email/password          |
| `POST` | `/auth/logout`             | Logout current user                |
| `GET`  | `/auth/github`             | OAuth login with GitHub            |
| `GET`  | `/auth/gitlab`             | OAuth login with GitLab            |
| `GET`  | `/auth/discord`            | OAuth login with Discord           |
| `GET`  | `/auth/linkedin`           | OAuth login with LinkedIn          |
| `POST` | `/auth/totp/setup`         | Setup TOTP (2FA)                   |
| `POST` | `/auth/totp/verify`        | Verify TOTP code                   |
| `POST` | `/auth/magic-link/send`    | Send magic link email              |
| `GET`  | `/auth/magic-link/{token}` | Login via magic link               |

### Users

| Method | Endpoint                  | Description                    |
| ------ | ------------------------- | ------------------------------ |
| `GET`  | `/users/me`               | Get current user info          |
| `GET`  | `/users/{id}`             | Get user by ID                 |
| `GET`  | `/users/search?q={query}` | Search users by email/username |

### Organizations

| Method   | Endpoint                                     | Description                |
| -------- | -------------------------------------------- | -------------------------- |
| `GET`    | `/organizations`                             | List user's organizations  |
| `POST`   | `/organizations`                             | Create new organization    |
| `GET`    | `/organizations/{id}`                        | Get organization details   |
| `DELETE` | `/organizations/{id}`                        | Delete organization        |
| `GET`    | `/organizations/{id}/members`                | List organization members  |
| `POST`   | `/organizations/{id}/members`                | Add member to organization |
| `DELETE` | `/organizations/{id}/members/{user_id}`      | Remove member              |
| `PUT`    | `/organizations/{id}/members/{user_id}/role` | Update member role         |

### Projects

| Method   | Endpoint                           | Description                            |
| -------- | ---------------------------------- | -------------------------------------- |
| `GET`    | `/projects`                        | List user's projects                   |
| `GET`    | `/organizations/{org_id}/projects` | List organization's projects           |
| `POST`   | `/projects`                        | Create new project                     |
| `GET`    | `/projects/{id}`                   | Get project details (includes gateway) |
| `DELETE` | `/projects/{id}`                   | Delete project                         |
| `GET`    | `/projects/{id}/members`           | List project members                   |
| `POST`   | `/projects/{id}/members`           | Add member to project                  |
| `DELETE` | `/projects/{id}/members/{user_id}` | Remove member                          |

### Gateway Management

| Method | Endpoint          | Description                            |
| ------ | ----------------- | -------------------------------------- |
| `POST` | `/gateway/start`  | Start gateway for organization         |
| `POST` | `/gateway/config` | Get gateway config (called by gateway) |
| `POST` | `/gateway/ready`  | Signal gateway is ready                |
| `POST` | `/gateway/stop`   | Stop gateway                           |

## Gateway API Endpoints

Gateway endpoints are accessed via WebSocket for collaboration data, and via HTTP for specific operations.

### Collaboration (WebSocket)

**Endpoint:** `wss://gateway.{org-id}.{env}.{domain}/collab/{room_id}?token=...`  
**Authentication:** `TJwtUser` (access_token only)

The WebSocket connection requires a user access token in the query parameter. The token must have a `project_id` (either in the JWT payload or inferred from the room_id), and the user must have access to that project (member, admin, or org admin/owner).

**Events sent to gateway:**

```typescript
// Container management
{
  type: 'user-containers:new',
  name: string,
  imageId: string
}

{
  type: 'user-containers:delete',
  user_container_id: string
}

{
  type: 'user-containers:host',
  user_container_id: string
}

// Graph operations
{
  type: 'core:new-node',
  nodeData: { ... }
}

// Chat
{
  type: 'chats:new-message',
  message: string,
  chat_id: string
}
```

**State updates from gateway:**

Gateway pushes state updates via Yjs synchronization protocol.

### HTTP Endpoints

| Method | Endpoint             | Authentication                                | Description                             |
| ------ | -------------------- | --------------------------------------------- | --------------------------------------- |
| `GET`  | `/collab/ping`       | None                                          | Health check                            |
| `POST` | `/collab/start`      | None (handshake token in body)                | Initialize gateway (called by Ganymede) |
| `GET`  | `/collab/room-id`    | `TJwtUser` with `project_id` + project access | Get room ID for a project               |
| `POST` | `/collab/event`      | `TJwtUser` with `project_id` + project access | Process collaborative event             |
| `GET`  | `/collab/vpn-config` | `TJwtUserContainer` (must belong to org)      | Get OpenVPN configuration               |

**Authentication Details:**

- **`GET /collab/room-id`**: Requires `TJwtUser` token. The `project_id` can be provided in JWT payload or as a query parameter (`?project_id=...`). The user must have project access (member, admin, or org admin/owner). Returns the room_id for the specified project.
- **`POST /collab/event`**: Requires `TJwtUser` token with `project_id` in the JWT payload. The user must have project access (member, admin, or org admin/owner).
- **`GET /collab/vpn-config`**: Requires `TJwtUserContainer` token. The token's `project_id` must belong to the organization this gateway is serving.

### OAuth2 Provider

Gateway provides OAuth2 for container applications:

| Method | Endpoint              | Authentication                    | Description                  |
| ------ | --------------------- | --------------------------------- | ---------------------------- |
| `GET`  | `/oauth/authorize`    | Session (Passport/req.user)       | OAuth authorization endpoint |
| `POST` | `/oauth/token`        | None (client credentials in body) | Exchange code for token      |
| `POST` | `/oauth/authenticate` | OAuth access token (Bearer)       | Validate OAuth token         |

**Authentication Details:**

- **`GET /oauth/authorize`**: Requires user to be authenticated via session cookie (Passport). Used for OAuth2 authorization flow where the user grants permission.
- **`POST /oauth/token`**: No authentication required. Uses client credentials (client_id, client_secret) from request body for OAuth2 token exchange.
- **`POST /oauth/authenticate`**: Requires OAuth2 access token (Bearer token) in Authorization header. Used by resource servers to validate tokens.

## Request/Response Examples

### Create Organization

**Request:**

```http
POST /organizations
Content-Type: application/json

{
  "name": "my-org"
}
```

**Response:**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-org",
  "owner_user_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2025-01-06T12:00:00.000Z"
}
```

### Create Project

**Request:**

```http
POST /projects
Content-Type: application/json

{
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-project",
  "public": false
}
```

**Response:**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "project_id": "660e8400-e29b-41d4-a716-446655440000",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-project",
  "public": false,
  "created_at": "2025-01-06T12:01:00.000Z"
}
```

### Get Project (with Gateway)

**Request:**

```http
GET /projects/660e8400-e29b-41d4-a716-446655440000
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "project_id": "660e8400-e29b-41d4-a716-446655440000",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-project",
  "public": false,
  "created_at": "2025-01-06T12:01:00.000Z",
  "gateway": {
    "gateway_id": "770e8400-e29b-41d4-a716-446655440000",
    "hostname": "gateway.550e8400.dev-001.domain.com",
    "ready": true,
    "websocket_url": "wss://gateway.550e8400.dev-001.domain.com/collab"
  }
}
```

## Error Responses

Standard HTTP error codes:

| Code  | Meaning                            |
| ----- | ---------------------------------- |
| `400` | Bad Request - Invalid input        |
| `401` | Unauthorized - Not authenticated   |
| `403` | Forbidden - Not authorized         |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `500` | Internal Server Error              |

**Error Response Format:**

```json
{
  "error": "Error message describing what went wrong"
}
```

## OpenAPI Specifications

Detailed API schemas are defined in OpenAPI 3.0 format:

- **Ganymede:** `packages/app-ganymede/src/oas30.json`
- **Gateway:** `packages/app-gateway/src/oas30.json`

These specs include:

- Complete request/response schemas
- Validation rules
- Parameter descriptions
- Example values

## Related Documentation

- **[Architecture Overview](../architecture/OVERVIEW.md)** - System architecture
- **[Local Development](../guides/LOCAL_DEVELOPMENT.md)** - Testing APIs locally
- **[Contributing](../../CONTRIBUTING.md)** - Adding new endpoints
