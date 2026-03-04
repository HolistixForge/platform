# Gateway Module

Provides gateway infrastructure services including token management, permissions, DNS, reverse proxy control, and Ganymede communication.

## Features

- **Token Management**: JWT token generation, validation, and lifecycle management
- **Permission System**: Fine-grained permission checking and registry
- **DNS Management**: Dynamic DNS record management for container URLs
- **Reverse Proxy**: Nginx reverse proxy configuration and updates
- **Ganymede Communication**: HTTP client for communicating with the main API server (both user-authenticated and gateway-internal calls)

## API

Exports managers for tokens, permissions, and DNS. Provides `toGanymede` and `toGanymedeInternal` functions for API calls. `updateReverseProxy` manages nginx configuration. `PermissionRegistry` allows modules to register permission definitions. Gateway metadata includes FQDN and organization ID.

## Dependencies

- `collab`: For shared data (frontend only)

## Exports

- `TGatewayExports`: Complete gateway services interface
- `TokenManager`: JWT token management
- `PermissionManager`: Permission checking and enforcement
- `DNSManager`: DNS record management
- `PermissionRegistry`: Permission definition registry
- `TGatewaySharedData`, `TGatewayMeta`: Shared data types
- Event types: `TEventDisableProjectUnloading`, `TEventProjectInit`
