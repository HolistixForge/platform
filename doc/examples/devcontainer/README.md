# HolistixForge Platform DevContainer (Optional Example)

This directory contains an **optional example** development container configuration for the HolistixForge platform.

> **Note**: This devcontainer configuration is not required for development. It's provided as an example for teams who want to use containerized development environments.

## Overview

The devcontainer uses VS Code Server (code-server) to provide a consistent development environment that can be accessed through a web browser or VS Code's Remote - Containers extension.

## Features

- **VS Code Server**: Full VS Code experience in the browser
- **Pre-configured Extensions**: Essential extensions for TypeScript, React, and the platform
- **Consistent Environment**: Same development environment for all team members
- **Volume Persistence**: Extensions and settings are preserved across container restarts

## Usage

### Setup (One-time)

To use this devcontainer configuration, copy it to the repository root:

```bash
cp -r doc/examples/devcontainer .devcontainer
```

Or create a symlink:

```bash
ln -s doc/examples/devcontainer .devcontainer
```

### With VS Code Desktop

1. Copy the devcontainer to `.devcontainer/` in the repository root (see Setup above)
2. Install the [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
3. Open the project folder in VS Code
4. Click "Reopen in Container" when prompted (or use Command Palette: "Remote-Containers: Reopen in Container")

### With VS Code Server (Browser)

1. Copy the devcontainer to `.devcontainer/` in the repository root (see Setup above)
2. Build and start the container:
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml up -d
   ```

3. Access VS Code Server at http://localhost:8080

## Configuration

- `devcontainer.json`: Main configuration file
- `docker-compose.yml`: Docker Compose configuration for the dev environment

## Customization

You can customize the development environment by modifying:
- Extensions in `devcontainer.json` under `customizations.vscode.extensions`
- VS Code settings in `customizations.vscode.settings`
- Docker configuration in `docker-compose.yml`
