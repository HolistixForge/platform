# Gateway Module

Provides gateway infrastructure services including OAuth2 provider, token management, permissions, DNS, reverse proxy control, and a generic protected-service registry.

## Features

- **OAuth2 Provider**: Full OAuth2 authorization server for container applications
- **Token Management**: JWT token generation, validation, and lifecycle management
- **Permission System**: Fine-grained permission checking and registry
- **DNS Management**: Dynamic DNS record management for container URLs
- **Reverse Proxy**: Nginx reverse proxy configuration and updates
- **Ganymede Communication**: HTTP client for communicating with the main API server
- **Protected Services**: Generic registry for module-defined protected services (HTTP/WS metadata)

## API

Exports managers for OAuth, tokens, permissions, and DNS. Provides `toGanymede` function for API calls. `updateReverseProxy` manages nginx configuration. `PermissionRegistry` allows modules to register permission definitions. `ProtectedServiceRegistry` lets modules declare protected services that the gateway can guard with JWT + permissions. Gateway metadata includes FQDN and organization ID.

## Dependencies

- `collab`: For shared data (frontend only)

## Exports

- `TGatewayExports`: Complete gateway services interface
- `TokenManager`: JWT token management
- `OAuthManager`: OAuth2 provider implementation
- `PermissionManager`: Permission checking and enforcement
- `DNSManager`: DNS record management
- `PermissionRegistry`: Permission definition registry
- `ProtectedServiceRegistry`: Protected-service registration (for HTTP/WS metadata)
- `TGatewaySharedData`, `TGatewayMeta`: Shared data types
- Event types: `TEventLoad`, `TEventDisableShutdown`

