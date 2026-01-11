# VS Code Server Module

This module provides VS Code Server (code-server) as a user container image, allowing browser-based development within the HolistixForge platform.

## Overview

VS Code Server is a browser-based IDE that provides the full Visual Studio Code experience accessible through a web browser. This module integrates code-server into the HolistixForge platform as a user container.

## Features

- Full VS Code experience in the browser
- Access to VS Code extensions
- Integrated terminal
- File system access within the container
- OAuth integration for secure access

## Container Configuration

- **Image**: `holistixforge/vscode-server:4.97.1`
- **Service Port**: 8080
- **Service Name**: `vscode`
- **Container Type**: Development environment

## Usage

Users can launch VS Code Server containers from the HolistixForge UI. The container will be accessible via a unique FQDN routed through the gateway.
