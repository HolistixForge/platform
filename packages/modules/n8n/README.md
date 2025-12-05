# n8n Module

n8n workflow automation platform integration for Holistix Forge.

## Features

- Registers n8n container image with user-containers module
- OAuth integration for user authentication
- Workflow automation and data integration

## Container Image

**Location:** `docker-image/`  
**Base:** `docker.n8n.io/n8nio/n8n:1.97.1`  
**Image ID:** `n8n:latest`  
**Services:** n8n on port 5678

## Dependencies

- `user-containers` - For image registration

## Building the Image

From the module directory:

```bash
cd packages/modules/n8n/docker-image
docker build -t holistixforge/n8n:1.97.1 .
```
