# Module System

The base module system provides the foundation for all Holistix modules. It defines the module interface, dependency resolution, and loading mechanism.

## Features

- **Module Interface**: Defines the standard structure for modules with name, version, description, and dependencies
- **Dependency Resolution**: Automatically resolves and validates module dependencies before loading
- **Export System**: Enables modules to export functionality for use by other modules
- **Type Safety**: Full TypeScript support for module dependencies and exports

## API

Modules implement the `TModule` interface with required dependencies and optional exports. The `loadModules` function handles dependency resolution and sequential loading. Modules can declare dependencies on other modules, which are validated and loaded in the correct order.

## Dependencies

No dependencies - this is the base module system.

## Exports

- `TModule`: Type definition for module interface
- `loadModules`: Function to load and initialize modules with dependency resolution
