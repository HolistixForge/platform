# User Containers Module

Manages Docker container lifecycle for user-deployed applications, including image registry, container runners, and stable DNS URLs.

## Features

- **Container Management**: Create, delete, and manage Docker containers
- **Image Registry**: Centralized registry for container image definitions
- **Container Runners**: Pluggable runner system supporting local and cloud deployments
- **Stable URLs**: DNS-based stable URLs for container access
- **OAuth Integration**: Automatic OAuth client registration for containers
- **Permission System**: Fine-grained permissions for container operations

## API

Exports `imageRegistry` for managing container images, `registerContainerRunner` for adding custom runners, and `getRunner` for accessing runners. Registers permissions for create, delete, and host operations. Manages shared data for containers and images.

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data
- `reducers`: For event processing
- `gateway`: For OAuth, DNS, and permissions

## Exports

- `TUserContainersExports`: Container management interface
- `TUserContainer`: Container type definition
- `TContainerImageDefinition`, `TContainerImageInfo`: Image types
- `ContainerImageRegistry`: Image registry class
- `ContainerRunner`: Runner interface
- `serviceUrl`: Helper for generating container URLs
- Event types: `TEventNew`, `TEventDelete`

