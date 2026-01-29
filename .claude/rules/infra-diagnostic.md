# Infrastructure Diagnostic Tool Usage

## When to Use

Run `./scripts/local-dev/infra-diagnostic.sh` in these situations:

1. **User asks about infrastructure status** - "Is everything running?", "Check services", "What's wrong?"
2. **User reports issues** - Connection failures, DNS problems, service not responding, container issues
3. **After infrastructure changes** - After setup scripts, starting/stopping services, creating/deleting environments, DNS changes
4. **When troubleshooting** - Before suggesting fixes, run diagnostics to understand current state
5. **As verification** - After completing setup or applying fixes

## How to Use

```bash
./scripts/local-dev/infra-diagnostic.sh
```

## What It Checks

- **Environment Information**: All environments with domains and workspace paths
- **Core Services**: PostgreSQL, Nginx, CoreDNS, PowerDNS
- **Observability Stack**: OTLP Collector, Loki, Tempo, Grafana containers
- **Gateway Containers**: All running gateway containers with status
- **DNS Resolution**: DNS for local and external domains
- **HTTPS Connectivity**: HTTPS endpoints for all environments
- **Network Information**: Docker socket, network configuration

## Output Interpretation

- Green checkmarks: Working correctly
- Red X marks: Failed
- Yellow warnings: Non-critical issues or missing optional components
- Summary: Total checks, passed/failed counts, success rate

## Best Practices

1. **Run diagnostics first** when troubleshooting - don't guess the problem
2. **Share the output** with the user when relevant
3. **Use the summary** to quickly identify critical failures
4. **Follow up** on failed checks with specific fixes
5. **Re-run diagnostics** after applying fixes to verify

The diagnostic tool is non-destructive (read-only) and safe to run multiple times.
