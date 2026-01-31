# GitHub CLI Integration

## Repository Context

This workspace is connected to: `HolistixForge/platform`

## User Confirmation Required

**CRITICAL RULE:** Before executing ANY GitHub CLI command that modifies data (creates issues, updates issues, creates PRs, etc.), you MUST:

1. Show the command to the user first
2. Explain what it will do
3. Wait for explicit user confirmation before executing
4. Never execute destructive or modifying commands without user approval

Read-only commands (`gh issue list`, `gh issue view`) can be executed without confirmation.

## Context Gathering: Open Issues Awareness

**IMPORTANT:** When starting work on a new feature or bug fix, check open GitHub issues to understand the current project state:

```bash
# List all open issues
gh issue list --repo HolistixForge/platform --state open

# View a specific issue
gh issue view <issue-number> --repo HolistixForge/platform
```

When processing a request:

1. **Check if the request relates to** an existing open issue (reference the issue number)
2. **Inform the user** if their request is already tracked, matches a TODO item, or is a new request that might benefit from an issue
3. **Cross-reference** with existing open issues to avoid duplicate work
4. **Reference existing issues** when relevant: "This relates to issue #123"

## Common Workflows

### Creating GitHub Issues

1. Analyze the request
2. Gather context and acceptance criteria
3. Draft the issue with clear title, description, and labels
4. **Show the command and get user confirmation**
5. Create the issue only after user confirms

```bash
gh issue create \
  --title "Issue Title" \
  --body "Issue description with markdown support" \
  --label "bug,enhancement" \
  --repo HolistixForge/platform
```

### Viewing Issues

```bash
# List all open issues
gh issue list --repo HolistixForge/platform

# View a specific issue
gh issue view <issue-number> --repo HolistixForge/platform

# View in web browser
gh issue view <issue-number> --web --repo HolistixForge/platform
```

### Converting TODOs to Issues

1. Read and understand the TODO item
2. Ask the user for context and requirements
3. Determine issue type, priority, labels, dependencies
4. Draft a comprehensive issue with conventional format title: `type(scope): description`
5. **Show command and get user confirmation** before creating

## Working with Code Scanning Alerts

### Fetching Alerts

```bash
# Get all code scanning alerts
gh api repos/HolistixForge/platform/code-scanning/alerts

# Summary by severity
gh api repos/HolistixForge/platform/code-scanning/alerts | jq '[.[] | select(.state == "open")] | [group_by(.rule.severity)[] | {severity: .[0].rule.severity, count: length}]'

# List open alerts with details
gh api repos/HolistixForge/platform/code-scanning/alerts | jq '[.[] | select(.state == "open")] | sort_by(.rule.severity) | reverse | .[] | {number: .number, severity: .rule.severity, description: .rule.description, file: .most_recent_instance.location.path, line: .most_recent_instance.location.start_line}'
```

### Alert Priority

- **Error/High severity** - Address immediately (SSRF, CSRF, path traversal, etc.)
- **Warning/Medium severity** - Address soon
- **Note/Low severity** - Address when convenient

### Fixing Alerts Workflow

1. Fetch and analyze all open alerts
2. Present summary with counts by severity
3. Ask user which alerts to prioritize
4. For each alert: get details, read affected code, propose fix, get confirmation, implement, test, commit with reference
5. Verify alerts resolved after push

### Commit Format for Security Fixes

```bash
git commit -m "fix(security): resolve code scanning alert #<alert-number>

Fixes code scanning alert: <description>
- <what was changed>
- <why it's now secure>

Code-Scanning-Alert: #<alert-number>"
```

## Best Practices

- **ALWAYS get user confirmation** before any modifying `gh` command
- Use descriptive titles following conventional commit format
- Include context in issue descriptions - link to code, related issues, documentation
- Add appropriate labels
- Reference issues in commit messages using `Closes #123` or `Fixes #456`
- Regular monitoring of code scanning alerts
- Don't dismiss alerts without fixing - only dismiss confirmed false positives

## Troubleshooting

- **gh not found**: Check `which gh`, install if missing
- **Auth errors**: Run `gh auth status`, re-auth with `gh auth login`
- **Repo access**: Verify with `gh repo view HolistixForge/platform`
