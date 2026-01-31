# Frontend Loading Chain

## Overview

When a user navigates to a project editor page, the frontend executes a sequential loading chain. Each step blocks the next. Understanding this chain is critical for debugging load performance issues.

## Loading Sequence

```
ProjectWrapper
├── useCurrentUser()              → POST /me (session validation)
├── useQueryProjectByName()       → GET /projects?name=... (parallel with above)
│
└── ModuleDataProvider
    ├── useQueryOrganizationGateway()  → GET /orgs/{org_id}/gateway
    │                                    (polls every 30s active, 120s inactive)
    │                                    If no gateway allocated, frontend triggers
    │                                    POST /gateway/start → allocation pipeline
    │
    ├── createModuleConfigs()          → Creates collab config + gateway fetch wrapper
    │
    ├── loadModules()                  → Synchronous module loading (~15ms)
    │                                    Applies configs: collab, reducers
    │
    └── OrganizationProvider + ModuleProvider
        └── ProjectProvider
            └── CollabProjectProvider
                ├── collabRegistry.getCollabForProject(project_id)
                │   → Creates YjsClientCollab (lazy, cached per project)
                │   → new WebsocketProvider(ws_server, room_id, ydoc)
                │       → WebSocket to wss://org-{uuid}.domain.local/project/{project_id}
                │
                └── ProjectDispatcherSync
                    → Sets gateway fetch + project_id on FrontendDispatcher
```

## Key Components

### ProjectWrapper (`app-frontend/src/app/pages/project/project-wrapper.tsx`)

Orchestrates the top-level loading. Shows loading progress at 10%, 30%, 70%.

### ModuleDataProvider (`frontend-data/src/lib/modules/module-data-provider.tsx`)

Blocking component: waits for `useQueryOrganizationGateway()` to return a `gateway_hostname`. Only loads modules (via `useMemo`) when hostname is available. Shows loading/unavailable UI.

### CollabProjectProvider (`modules/collab/src/lib/collab-project-provider.tsx`)

Gets the collab instance for the current project from `CollabRegistryFrontend`. The registry lazy-creates `YjsClientCollab` on first access and caches it.

### GatewayFetch (`frontend-data/src/lib/modules/gateway-fetch.ts`)

Wraps `GanymedeApi.fetch()` to route requests to the gateway URL (`https://org-{uuid}.domain.local`). Used by `FrontendDispatcher` to send events to `POST /collab/event`. This is a **cross-origin** request — the gateway must have `ALLOWED_ORIGINS` set.

## Token Acquisition

All authenticated API calls go through `GanymedeApi._doTokenLogic()` which:

1. Calls `LocalStorageStore.get('user')` to get an OAuth token
2. If no token: triggers `doOauthCode()` → `POST /oauth/authorize` → `POST /oauth/token`
3. If token expired: triggers refresh via `POST /oauth/token` with `grant_type=refresh_token`
4. Sets `Authorization` header on the request

Token state is shared across tabs via `LocalStorageChannel` (localStorage + storage events).

If token acquisition fails, `LocalStorageStore` enters an error state with a **30-second retry wait** (`ERROR_WAIT`). This can silently delay all API calls.

## WebSocket Connection

The WebSocket URL is constructed as:

```
wss://org-{uuid}.domain.local/project/{project_id}?token={jwt_access_token}
```

- `org-{uuid}` is the organization-specific gateway hostname
- `project_id` is used as the y-websocket room name
- `token` is the JWT access token, injected by `MyWebSocket` (extends WebSocket) from `collab.ts`

On token expiration (close code `4001`), `MyWebSocket` triggers `refreshToken()` which clears the cached token via `LocalStorageStore.reset()`.

## Gateway Cold-Start

When no gateway is allocated for an organization, the first page load triggers the full allocation pipeline. See GitHub issue #43 for details on the timing implications and proposed improvements.
