# HolistixForge Platform DevContainer

This directory contains the development container configuration for the HolistixForge platform.

## Overview

The devcontainer uses VS Code Server (code-server) to provide a consistent development environment that can be accessed through a web browser or VS Code's Remote - Containers extension.

## Features

- **VS Code Server**: Full VS Code experience in the browser
- **Pre-configured Extensions**: Essential extensions for TypeScript, React, and the platform
- **Consistent Environment**: Same development environment for all team members
- **Volume Persistence**: Extensions and settings are preserved across container restarts

## Usage

### With VS Code Desktop

1. Install the [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
2. Open the project folder in VS Code
3. Click "Reopen in Container" when prompted (or use Command Palette: "Remote-Containers: Reopen in Container")

### With VS Code Server (Browser)

1. Build and start the container:
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml up -d
   ```

2. Access VS Code Server at http://localhost:8080

## Configuration

- `devcontainer.json`: Main configuration file
- `docker-compose.yml`: Docker Compose configuration for the dev environment

## Customization

You can customize the development environment by modifying:
- Extensions in `devcontainer.json` under `customizations.vscode.extensions`
- VS Code settings in `customizations.vscode.settings`
- Docker configuration in `docker-compose.yml`
