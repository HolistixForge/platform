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

MCP servers `devin` and `linear-server` must be connected. If `mcp__devin__*`
tools are deferred, load them in one call:

```
ToolSearch: select:mcp__devin__ask_question,mcp__devin__read_wiki_structure
```

## 1. Open review findings — run the driver

```bash
node .claude/skills/conductor-loop/review-check.mjs
```

Verified output on this branch:

```
PR #57 — HolistixForge/platform
macOS: Ganymede answers, and the 502 is gone
7 open, 8 resolved
checks: 1 in_progress, 6 success

OPEN
  🔍 Reuse of an existing Postgres depends on an unverified `network` field in `container inspect`
     scripts/local-dev/macos/ganymede-apple.sh:119
     https://github.com/HolistixForge/platform/pull/57#discussion_r3721203462
  ...
```

Exit status is **1 while anything is open**, 0 when clean, 2 on error — so it
gates a loop rather than needing to be read.

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

`read_wiki_structure` returns the page list (verified: 9 sections, from
"Ganymede — Control Plane" through "Observability"). `ask_question` answers
with file and function names, which is what makes it worth the call — ask for
those explicitly:

> "Does Ganymede talk to the Docker socket to create gateway containers, or
> only to the `gateways` table? Name the exact files and functions."

That question corrected a wrong assumption that would otherwise have shaped a
whole ticket. **The wiki is a map, not ground truth** — it is generated from
the code at some past point. Treat an answer as a pointer to the file to open,
never as the last word, and never quote it as a measurement.

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
makes the next ticket possible to scope.

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
  the same line for that reason — `7 open, 8 resolved` next to
  `1 in_progress, 6 success`.

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
