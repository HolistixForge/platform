---
name: conductor-loop
description: The per-iteration loop for working in a Conductor workspace on this repo — check open Devin review findings on the branch's PR, consult the DeepWiki before touching an unfamiliar subsystem, and keep the Linear issue updated as work lands. Use when starting a ticket, before committing, after pushing, when asked "what's left", or when reviewing PR feedback.
---

# Conductor iteration loop

Three things go stale between iterations and each one has cost real work here:
a **re-review** that landed while you were mid-change, a **subsystem** you
guessed at instead of reading, and a **Linear issue** describing an intention
rather than what happened.

The first is scripted. The other two are MCP calls, listed below with the exact
arguments that answer.

Paths are relative to the repo root.

## Prerequisites

```bash
gh auth status          # must be authenticated for HolistixForge/platform
node --version          # v25 here; the driver is dependency-free ESM
```

MCP servers `devin` and `linear-server` must be connected. Their tools are
usually deferred — load every one this skill uses in a **single** call, not one
per tool:

```
ToolSearch: select:mcp__devin__read_wiki_structure,mcp__devin__ask_question,mcp__linear-server__list_issues,mcp__linear-server__get_issue
```

## 1. Open review findings — run the driver

```bash
node .claude/skills/conductor-loop/review-check.mjs
```

Verified output on this branch:

```
PR #57 — HolistixForge/platform
macOS: Ganymede answers, and the 502 is gone
18 open, 12 resolved
checks: 8 success

OPEN
  🔴 Container login gateways cannot be registered in the macOS environment because the site address is stored with its port attached
     scripts/local-dev/macos/ganymede-apple.sh:334
     https://github.com/HolistixForge/platform/pull/57#discussion_r3721469459
  🟨 Development containers are configured to accept any TLS certificate
     scripts/local-dev/macos/ganymede-apple.sh:324
     https://github.com/HolistixForge/platform/pull/57#discussion_r3721470227
  🟡 Newly started gateway containers are wrongly reported as failed
     scripts/local-dev/macos/gateway-apple.sh:323
     ...
```

Counts move fast — that same PR read `7 open, 8 resolved` one session earlier.
A number here that matches what you remember is a reason to suspect you are
reading a cached memory rather than the PR.

Exit status is **1 while anything is open**, 0 when clean, 2 on error — so it
gates a loop rather than needing to be read.

### Reading the severities

Devin runs **three separate review jobs** per PR, each with its own emoji pair.
Measured over #53–#57, 156 root comments:

| Job         | Emoji | Meaning  | Notes                                          |
| ----------- | ----- | -------- | ---------------------------------------------- |
| `BUG_`      | 🔴    | critical | a defect it is confident about                 |
| `BUG_`      | 🟡    | bug      |                                                |
| `SEC_`      | 🟨    | security | the security swarm; its own job, its own round |
| `ANALYSIS_` | 🔍    | analysis | a question about an assumption                 |
| `ANALYSIS_` | 📝    | info     | an observation, often "this is safe because…"  |

They are printed in that order. Three jobs means **a PR can go quiet on one and
still be re-reviewed on another** — #57 gained eleven findings, most of them
`SEC_`, between two runs of this driver in the same session.

**CodeQL is not Devin.** GitHub Advanced Security posts under a different bot
with no Devin marker, and it is listed in its own `CODEQL` block:

```
CODEQL (3) — resolved on GitHub, not by reply
  🛡️  CodeQL / Disabling certificate validation
     scripts/local-dev/verify-collab-websocket.mjs:261
```

Those do **not** affect the exit status: a CodeQL comment is never closed by a
reply, only by fixing or dismissing the alert in the security tab. PR #54 exits
0 with three of them open. See the repo's code-scanning rules for the
`gh api …/code-scanning/alerts` workflow.

Other forms, all verified:

```bash
node .claude/skills/conductor-loop/review-check.mjs 56       # a specific PR
node .claude/skills/conductor-loop/review-check.mjs --all    # resolved ones too
node .claude/skills/conductor-loop/review-check.mjs --json    # for further filtering
```

It is **read-only** — `gh api`, `gh pr list`, `gh pr view`. The repo rule
requiring confirmation before a modifying `gh` command does not apply to it.

**Run it after every push.** Devin re-reviews each push, and a re-review is a
new set of root comments — not edits to the old ones. Twice in one session a
fresh finding was noticed only because somebody happened to look again.

Findings that are wrong are common and saying so is the right answer. Of the
last two rounds here, five of six were real defects and one was a confirmation
that a change was safe. Read the code before agreeing.

## 2. DeepWiki — before touching a subsystem you have not read

```
mcp__devin__read_wiki_structure   repoName: "HolistixForge/platform"
mcp__devin__ask_question          repoName: "HolistixForge/platform"
                                  question: "<a specific question>"
```

`read_wiki_structure` returns the page list — verified: **9 top-level sections**,
`1 Holistix Forge Platform — Overview` through `9 Glossary`, with the ones you
will actually want nested inside (`2.1 Ganymede — Control Plane`,
`2.3 Networking: Nginx, CoreDNS, and VPN`, `8.3 Observability`). Ask for a
numbered subsection, not a top-level title.

`ask_question` answers with file and function names, which is what makes it
worth the call — ask for those explicitly:

> "Which files and functions write and reload nginx configuration for an
> environment? Name the exact files, classes and methods, and say whether the
> nginx config test command is run before reload."

It named `NginxManager` in `packages/app-ganymede/src/services/nginx-manager.ts`,
its `createGatewayConfig` / `reloadNginx` / `removeGatewayConfig` methods, and
the Stage 1 vs Stage 2 nginx distinction — a genuinely useful map.

**And in the same breath it was wrong.** It stated that `reloadNginx` runs
`sudo nginx -t 2>&1` before reloading. The current file does not:

```bash
grep -n 'testCommand' packages/app-ganymede/src/services/nginx-manager.ts
# 44:  this.testCommand = process.env.NGINX_TEST_COMMAND || 'sudo nginx -t 2>&1';
```

The command became overridable, which is the subject of an open finding on
#57 ("Making the nginx test command overridable disables config validation on
macOS"). The wiki was describing the code as it stood before the branch.

So: **the wiki is a map, not ground truth.** Treat an answer as a pointer to
the file to open, never as the last word, and never quote it as a measurement.
It is at its most convincing precisely where it is stalest — on the file you
are currently changing.

## 3. Linear — as work lands, not at the end

```
mcp__linear-server__list_issues   parentId: "TAC-129", fields: ["title","status"]
mcp__linear-server__get_issue     id: "TAC-176"
mcp__linear-server__save_issue    id: "TAC-176", state: "Done",
                                  patch: [{op: "append", text: "..."}]
```

Append findings to the issue **as they are measured**, with the commit hash and
the numbers. What belongs there is the thing that is not in the diff: what was
tried and rejected, what the measurement was, and what is knowingly left
undone. A ticket closed with "done" is a ticket that has to be re-derived.

Every issue closed here ends with a "noted, not fixed" list. That list is what
makes the next ticket possible to scope. TAC-176 is the shape to copy — a
`## Terminé — <sha>` block, the measured evidence, then
`### Noté au passage, non corrigé` with three items that each became scopeable
work.

### Linking the PR — Conductor breaks the automatic path

Linear auto-links a PR by **branch name**, and hands you the name it expects:

```
mcp__linear-server__get_issue  id: "TAC-176"   → gitBranchName:
  "chrysostome/tac-176-un-gateway-sous-apple-container-ce-qui-rend-le-runner"
```

A Conductor workspace branch is not that name. Here the local branch is
`create-pr`, tracking `origin/commit-and-deploy-images-v1` — neither is
`chrysostome/tac-176-…`, so the branch heuristic has nothing to match on.

The result is **per issue, and easy to misread**. For the same PR #57:

| Issue   | `attachments`     |
| ------- | ----------------- |
| TAC-175 | PR #57 — linked   |
| TAC-176 | `[]` — not linked |

TAC-175 got its link (from the PR body, or by hand). TAC-176 — the ticket that
describes the gateway work and closes with the fullest write-up of it — closed
pointing at nothing. **Check the issue you actually care about**; one linked
sibling says nothing about the others.

So either branch as Linear asks, or attach the PR yourself:

```
mcp__linear-server__create_attachment   issueId: "TAC-176",
                                        url: "https://github.com/HolistixForge/platform/pull/57",
                                        title: "PR #57"
```

That is a **write to an external service** — the repo rule on modifying
commands applies. Show it and get confirmation before running it.

## Gotchas

- **`gh pr view` looks up the PR by the _local_ branch name.** A Conductor
  workspace directory named `algiers` can hold a branch named `create-pr`
  tracking `origin/commit-and-deploy-images-v1`; `gh` then reports "no pull
  requests found" while the PR is open. The driver asks git for the upstream
  first. Check yours before trusting any `gh` output:

  ```bash
  git rev-parse --abbrev-ref --symbolic-full-name '@{u}'   # origin/commit-and-deploy-images-v1
  git branch --show-current                                # create-pr
  ```

- **The same mismatch breaks pushes.** `git push origin HEAD` creates a _new_
  remote branch named after the local one. Always name the target:

  ```bash
  git push origin HEAD:commit-and-deploy-images-v1
  ```

  If it has already happened: `git push origin --delete create-pr`.

- **A finding is closed by Devin, not by you.** Resolution is a _reply_ whose
  body starts with `✅ **Resolved**`, posted by `devin-ai-integration[bot]`
  after it re-reads the code. A human reply saying "fixed" changes nothing, and
  the driver deliberately does not count it.

- **`save_issue` with `patch` needs each anchor to match exactly once.** One
  failing operation aborts the whole save. For a status block appended to a
  long description, `{op: "append"}` has no anchor and cannot miss.

- **Linear renders `<issue id="TAC-176">` into a live link** only when the id
  resolves; it rewrites it on save. Write the plain identifier and let it.

- **A green review is not a green branch.** The driver prints check status on
  the same line for that reason — `18 open, 12 resolved` next to `8 success`.
  PR #54 has nothing open and `2 failure, 5 success, 1 skipped`.

- **Counting findings by hand with `jq` string slicing silently merges the
  severities.** Taking the first two codepoints of a body to read its emoji
  (`.body[0:2]`) collapsed 📝 into 🔍 and 🟡 into 🔴 in this session, and
  `sort | uniq -c` then reported a clean, confident, wrong inventory — three
  severities where there are five. The totals still added up, which is what
  made it convincing. Slice wider (`[0:6]`) and strip the `**` afterwards, or
  just use `--json` and let the driver do the parsing:

  ```bash
  node .claude/skills/conductor-loop/review-check.mjs --json \
    | jq -r '.open[] | .severity' | sort | uniq -c
  ```

- **Listing the available skills with a glob does not work in this shell.**
  zsh errors on a glob that matches nothing (`no matches found`), which reads
  like a failure rather than an absence — and the fix everyone reaches for, the
  `(N)` qualifier, is itself disabled here: the harness starts zsh with
  `NO_BARE_GLOB_QUAL`, so `(N)` is taken literally and the loop silently prints
  nothing. Both failure modes look like "no skills". Use `find`:

  ```bash
  find . -maxdepth 4 -path '*/.claude/skills/*/SKILL.md' \
    -exec grep -Hm1 '^description:' {} \;
  ```

## Troubleshooting

| Symptom                                | Cause                                           | Fix                                                             |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `No open PR for this branch` (exit 2)  | local branch name ≠ remote, and no upstream set | `git branch -u origin/<remote-branch>`, or pass the PR number   |
| `gh: Not Found` from the driver        | not authenticated, or no access to the repo     | `gh auth status`, then `gh repo view HolistixForge/platform`    |
| Driver prints `checks: could not read` | the PR has no checks yet, or `gh` rate-limited  | harmless; the findings above it are still correct               |
| `mcp__devin__*` tool not found         | deferred tools not loaded                       | one `ToolSearch` call with `select:` and a comma-separated list |
| Wiki answer contradicts the code       | the wiki lags the repo                          | the code wins — open the file it named                          |

## The driver

`.claude/skills/conductor-loop/review-check.mjs` — dependency-free ESM,
shells out to `gh` and `git`. Read it before extending it; the resolution
logic and the upstream fallback both encode failures that already happened.
