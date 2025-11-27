# Gateway Module

Provides gateway infrastructure services including OAuth2 provider, token management, permissions, DNS, and reverse proxy control.

## Features

- **OAuth2 Provider**: Full OAuth2 authorization server for container applications
- **Token Management**: JWT token generation, validation, and lifecycle management
- **Permission System**: Fine-grained permission checking and registry
- **DNS Management**: Dynamic DNS record management for container URLs
- **Reverse Proxy**: Nginx reverse proxy configuration and updates
- **Ganymede Communication**: HTTP client for communicating with the main API server

## API

Exports managers for OAuth, tokens, permissions, and DNS. Provides `toGanymede` function for API calls. `updateReverseProxy` manages nginx configuration. `PermissionRegistry` allows modules to register permission definitions. Gateway metadata includes FQDN and organization ID.

## Dependencies

- `collab`: For shared data (frontend only)

## Exports

- `TGatewayExports`: Complete gateway services interface
- `TokenManager`: JWT token management
- `OAuthManager`: OAuth2 provider implementation
- `PermissionManager`: Permission checking and enforcement
- `DNSManager`: DNS record management
- `PermissionRegistry`: Permission definition registry
- `TGatewaySharedData`, `TGatewayMeta`: Shared data types
- Event types: `TEventLoad`, `TEventDisableShutdown`

