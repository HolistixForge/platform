# Jupyter Module

Integration module for JupyterLab notebooks, providing pre-configured container images and Jupyter-specific functionality.

## Features

- **JupyterLab Images**: Pre-configured Docker images for JupyterLab (minimal and PyTorch variants)
- **OAuth Integration**: Automatic OAuth client setup for JupyterLab authentication
- **Container Configuration**: Specialized container options for Jupyter (ports, capabilities, devices)
- **Jupyter Servers**: Manages Jupyter server instances within containers
- **Terminal Support**: Enables terminal access in JupyterLab

## API

Registers Jupyter container images with the user-containers module. Manages shared data for Jupyter servers. Provides container image definitions with OAuth clients, port mappings, and Docker capabilities. Exports container images array for reference.

## Dependencies

- `core-graph`: For graph node integration
- `collab`: For shared data
- `reducers`: For event processing
- `user-containers`: For container management

## Exports

- `TJupyterExports`: Jupyter module exports
- `TJupyterSharedData`: Jupyter shared data type
- `TJupyterEvent`: Jupyter event types
- `TJupyterExtraArgs`: Extra arguments for Jupyter operations
- `containerImages`: Array of pre-configured Jupyter images

