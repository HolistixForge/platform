# Troubleshooting Guide

Common issues and solutions for Holistix Forge local development.

## Table of Contents

1. [Port Conflicts](#port-conflicts)
2. [Docker Issues](#docker-issues)
3. [DNS Resolution](#dns-resolution)
4. [Observability Stack](#observability-stack)
5. [WSL2 Specific Issues](#wsl2-specific-issues)

---

## Port Conflicts

### IDE Auto Port Forwarding Conflicts

**Problem:** Service shows "Connection reset" when accessed via `localhost:<port>`, but container is healthy.

**Common Cause:** IDEs (Cursor, VS Code, JetBrains) automatically detect and forward ports, creating conflicts with Docker port mappings.

**Affected Services:**

- Grafana (port 3000)
- OTLP Collector (ports 4317, 4318)
- Custom services running in dev container

**Symptoms:**

```bash
# Container is running
docker ps  # Shows: 0.0.0.0:3000->3000/tcp

# Direct access works
curl http://172.18.0.x:3000  # ✅ Works

# But localhost access fails
curl http://localhost:3000   # ❌ Connection reset
```

**Solution 1: Disable IDE Port Forwarding**

**Cursor / VS Code:**

1. Open the **PORTS** panel (bottom panel, next to Terminal)
2. Find the conflicting port
3. Right-click → **Stop Forwarding Port**

**JetBrains IDEs:**

1. Settings → Build, Execution, Deployment → Docker
2. Uncheck "Expose ports on host"

**Solution 2: Configure IDE to Ignore Specific Ports**

Create/edit `.vscode/settings.json` in your project root:

```json
{
  "remote.autoForwardPorts": false,
  "remote.portsAttributes": {
    "3000": {
      "label": "Grafana (Docker)",
      "onAutoForward": "ignore"
    },
    "4318": {
      "label": "OTLP Collector (Docker)",
      "onAutoForward": "ignore"
    }
  }
}
```

**Solution 3: Change Service Port**

If you need the IDE port forwarding for another purpose, change the Docker service port:

```bash
# Example: Change Grafana from 3000 to 3001
docker stop observability-grafana
docker rm observability-grafana
# Re-run with -p 3001:3000 instead of -p 3000:3000
```

---

## Getting More Help

If none of these solutions work:

1. **Check the full logs:**

   ```bash
   docker logs <container-name> 2>&1 | less
   ```

2. **Run diagnostic script:**

   ```bash
   ./scripts/local-dev/infra-diagnostic.sh
   ```

3. **Check open issues:**

   ```bash
   gh issue list --repo HolistixForge/platform --state open
   ```

4. **Create a GitHub issue:**
   - Include error messages
   - Include relevant logs
   - Include system information (OS, Docker version, etc.)

---

## Related Documentation

- [Local Development Setup](LOCAL_DEVELOPMENT.md)
- [Observability Setup](../../scripts/local-dev/OBSERVABILITY_SETUP.md)
- [DNS Setup Guide](DNS_COMPLETE_GUIDE.md)
- [Windows Port Forwarding](../../scripts/windows/README.md)
