# pgAdmin4 Module

PostgreSQL administration and development platform integration for Holistix.

## Features

- Registers pgAdmin4 container image with user-containers module
- OAuth integration for user authentication
- Database management and query tools

## Container Image

**Location:** `docker-image/`  
**Base:** `dpage/pgadmin4:8.12.0`  
**Image ID:** `pgadmin:latest`  
**Services:** pgAdmin on port 5050

## Dependencies

- `user-containers` - For image registration

## Building the Image

From the module directory:

```bash
cd packages/modules/pgadmin4/docker-image
docker build -t holistixforge/pgadmin4:8.12.0 .
```
