# Infrastructure Diagnostic Tool Usage

## When to Use

The agent should run `./scripts/local-dev/infra-diagnostic.sh` (or `infra-diagnostic.sh` from the scripts directory) in the following situations:

1. **User asks about infrastructure status or health**

   - "Is everything running?"
   - "Check the status of services"
   - "What's wrong with my setup?"
   - "Are all services up?"

2. **User reports issues or errors**

   - Connection failures
   - DNS resolution problems
   - Service not responding
   - Container issues
   - Network connectivity problems

3. **After making infrastructure changes**

   - After running setup scripts
   - After starting/stopping services
   - After creating/deleting environments
   - After DNS configuration changes

4. **When troubleshooting**

   - Before suggesting fixes, run diagnostics to understand the current state
   - When user says "it's not working" without specifics
   - When multiple services might be involved

5. **As a verification step**
   - After completing setup instructions
   - To verify a fix worked
   - To confirm all services are running correctly

## How to Use

```bash
# From the monorepo root
cd /root/workspace/monorepo/scripts/local-dev
./infra-diagnostic.sh

# Or from anywhere in the monorepo
./scripts/local-dev/infra-diagnostic.sh
```

## What It Checks

The diagnostic tool provides comprehensive infrastructure health checks:

- **Environment Information**: Lists all environments with their domains and workspace paths
- **Core Services**: PostgreSQL, Nginx, CoreDNS, PowerDNS
- **Observability Stack**: OTLP Collector, Loki, Tempo, Grafana containers
- **Gateway Containers**: Lists all running gateway containers with their status
- **DNS Resolution**: Tests DNS resolution for local and external domains
- **HTTPS Connectivity**: Tests HTTPS endpoints for all environments
- **Network Information**: Docker socket, network configuration

## Output Interpretation

The tool provides:

- ✅ **Green checkmarks**: Service/check is working correctly
- ❌ **Red X marks**: Service/check has failed
- ⚠️ **Yellow warnings**: Non-critical issues or missing optional components
- **Summary**: Total checks, passed/failed counts, and success rate

## Best Practices

1. **Run diagnostics first** when troubleshooting - don't guess the problem
2. **Share the output** with the user when relevant - it helps them understand the state
3. **Use the summary** to quickly identify if there are critical failures
4. **Follow up** on failed checks with specific fixes based on the diagnostic output
5. **Re-run diagnostics** after applying fixes to verify they worked

## Example Workflow

```
User: "My DNS isn't working"

Agent:
1. Runs: ./scripts/local-dev/infra-diagnostic.sh
2. Reviews output, especially DNS-related checks
3. Identifies specific issues (e.g., "CoreDNS not running")
4. Suggests fix: "CoreDNS is not running. Run: ./setup-coredns.sh"
5. After fix, re-runs diagnostics to verify
```

## Notes

- The diagnostic tool is non-destructive - it only reads status, doesn't modify anything
- It's safe to run multiple times
- It provides actionable error messages and fix suggestions
- The tool excludes the "observability" directory from environment listings (it's for config storage, not an environment)
