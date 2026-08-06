#!/usr/bin/env node
/**
 * review-check.mjs — the open findings on this branch's pull request.
 *
 * Devin posts each finding as a root review comment and, when it later agrees
 * the finding is addressed, a *reply* to that comment starting with
 * "✅ **Resolved**". So "open" is a root comment with no such reply — which is
 * not something `gh pr view` will tell you, and not something the PR page makes
 * obvious once a review has three rounds on it.
 *
 * Reading the list by hand is where findings get lost. Twice in one session a
 * re-review landed while work was in flight and was noticed only because
 * somebody happened to look again.
 *
 *   node .claude/skills/conductor-loop/review-check.mjs           # current branch
 *   node .claude/skills/conductor-loop/review-check.mjs 57        # a PR number
 *   node .claude/skills/conductor-loop/review-check.mjs --all     # resolved too
 *   node .claude/skills/conductor-loop/review-check.mjs --json
 *
 * Exit status is 1 when anything is open, so it can gate a loop:
 *   until node …/review-check.mjs; do echo "still open"; break; done
 */

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const asJson = args.includes('--json');
const prArg = args.find((a) => /^\d+$/.test(a));

const sh = (cmd, cmdArgs) => {
  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch (error) {
    const stderr = (error.stderr || '').toString().trim();
    throw new Error(`${cmd} ${cmdArgs.join(' ')}\n${stderr || error.message}`);
  }
};

// `gh pr view` looks up the PR by the *local* branch name. In a Conductor
// workspace that name is often not the name on the remote — a workspace called
// `create-pr` tracking `origin/commit-and-deploy-images-v1` reports "no pull
// requests found" while the PR is right there. The same mismatch sends
// `git push origin HEAD` to a new branch nobody asked for.
//
// So the upstream is asked for first, and the local name is only a fallback.
const upstreamBranch = () => {
  try {
    const ref = sh('git', [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ]);
    return ref.includes('/') ? ref.slice(ref.indexOf('/') + 1) : ref;
  } catch {
    return null;
  }
};

const resolvePr = () => {
  const repo = JSON.parse(
    sh('gh', ['repo', 'view', '--json', 'nameWithOwner'])
  ).nameWithOwner;

  if (prArg) return { number: Number(prArg), repo };

  for (const head of [
    upstreamBranch(),
    sh('git', ['branch', '--show-current']),
  ]) {
    if (!head) continue;
    const found = JSON.parse(
      sh('gh', [
        'pr',
        'list',
        '--repo',
        repo,
        '--head',
        head,
        '--state',
        'open',
        '--json',
        'number,title',
      ])
    );
    if (found.length) {
      return { number: found[0].number, repo, title: found[0].title, head };
    }
  }
  throw new Error(
    `No open PR for this branch.\n` +
      `  local:    ${sh('git', ['branch', '--show-current'])}\n` +
      `  upstream: ${upstreamBranch() ?? '(none)'}\n` +
      `Pass a number instead:  node ${process.argv[1]} <pr>`
  );
};

// The severity Devin puts at the top of the body. Kept as the emoji it actually
// writes rather than a normalised enum: the point is to match what is on the
// page, so a finding can be found again by eye.
//
// Measured over PRs #53–#57 (156 root comments), Devin runs *three* review jobs
// per PR and each one has its own pair of emoji:
//
//   BUG_…       🔴 critical   🟡 bug
//   SEC_…       🟨 security                (the security swarm — one job, one emoji)
//   ANALYSIS_…  🔍 analysis   📝 info
//
// 🟨 used to be missing here, which sank every security finding to the bottom
// of the list under a blank severity — the worst possible place for it. The job
// prefix is now read as a fallback so a *new* emoji degrades to the right
// bucket instead of to `unmarked`.
const SEVERITY = [
  ['🔴', 'critical'],
  ['🟨', 'security'],
  ['🟡', 'bug'],
  ['🔍', 'analysis'],
  ['📝', 'info'],
];

// The id in the marker is `<JOB>_pr-review-job-<hash>_NNNN`.
const JOB_FALLBACK = { BUG: 'bug', SEC: 'security', ANALYSIS: 'analysis' };

const parse = (body) => {
  // Every Devin finding opens with an HTML comment carrying its own id. Its
  // absence is how a human reply, or Devin's own resolution note, is told apart
  // from a finding.
  const marked = /^\s*<!--\s*devin-review-comment\s/.test(body);
  const job = body.match(/"id":\s*"([A-Z]+)_pr-review/)?.[1] ?? null;
  const stripped = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  const severity = SEVERITY.find(([emoji]) => stripped.startsWith(emoji));
  const headline =
    stripped
      .split('\n')
      .find((line) => line.trim())
      ?.replace(/\*\*/g, '')
      .replace(/^[🔴🟨🟡🔍📝]\s*/u, '')
      .trim() ?? '(empty)';
  return {
    isFinding: marked,
    job,
    severity: severity ? severity[1] : JOB_FALLBACK[job] ?? 'unmarked',
    emoji: severity ? severity[0] : ' ',
    headline,
  };
};

// The other half of "check the PR". A review with nothing open and a red check
// is not a finished branch, and the two are read in different places — so they
// are printed together here.
const checksLine = (repo, number) => {
  try {
    const rollup = JSON.parse(
      sh('gh', [
        'pr',
        'view',
        String(number),
        '--repo',
        repo,
        '--json',
        'statusCheckRollup',
      ])
    ).statusCheckRollup;
    if (!rollup?.length) return 'none reported';
    const tally = {};
    for (const check of rollup) {
      // A check still running has an empty conclusion, which is not a pass.
      const state = check.conclusion || check.status || 'PENDING';
      tally[state] = (tally[state] ?? 0) + 1;
    }
    return Object.entries(tally)
      .map(([state, n]) => `${n} ${state.toLowerCase()}`)
      .join(', ');
  } catch {
    return 'could not read';
  }
};

const main = () => {
  const { number, repo, title } = resolvePr();

  const comments = JSON.parse(
    sh('gh', [
      'api',
      `repos/${repo}/pulls/${number}/comments`,
      '--paginate',
      '--slurp',
    ])
  ).flat();

  const repliesTo = new Map();
  for (const c of comments) {
    if (!c.in_reply_to_id) continue;
    if (!repliesTo.has(c.in_reply_to_id)) repliesTo.set(c.in_reply_to_id, []);
    repliesTo.get(c.in_reply_to_id).push(c);
  }

  const findings = comments
    .filter((c) => !c.in_reply_to_id)
    .map((c) => {
      const meta = parse(c.body);
      const replies = repliesTo.get(c.id) ?? [];
      // Devin's own acknowledgement, not a human saying "done". A maintainer
      // replying "fixed" does not close a finding — the bot re-reads the code.
      const resolved = replies.some(
        (r) =>
          r.user.login.startsWith('devin-ai-integration') &&
          /^\s*✅\s*\*\*Resolved\*\*/.test(r.body)
      );
      return {
        id: c.id,
        url: c.html_url,
        author: c.user.login,
        file: c.path,
        line: c.line ?? c.original_line ?? null,
        resolved,
        ...meta,
      };
    })
    // A marked finding, or something from Devin that looks like one.
    //
    // The author fallback catches a finding whose marker format changed
    // upstream — losing those silently is the worse failure. But "any root
    // comment by Devin" was too wide: a note carrying neither an id nor a
    // severity is not a finding, nothing will ever reply `✅ **Resolved**` to
    // it, and it therefore counted as open forever and held the exit status
    // red with nothing to fix. `severity` falls back to the job prefix in the
    // marker, so `unmarked` means neither was there.
    .filter(
      (f) =>
        f.isFinding ||
        (f.author.startsWith('devin-ai-integration') &&
          f.severity !== 'unmarked')
    );

  const open = findings.filter((f) => !f.resolved);
  const done = findings.filter((f) => f.resolved);

  // CodeQL is a *different bot* (`github-advanced-security[bot]`) posting a body
  // with no Devin marker, so the filter above drops it on the floor — three such
  // alerts sat unseen on #54 and one on #56. Its lifecycle lives in the security
  // tab and it is never closed by a reply, so it is listed on its own and does
  // not gate the exit status; dismissing it is a decision made on GitHub.
  const codeql = comments
    .filter(
      (c) =>
        !c.in_reply_to_id && c.user.login.startsWith('github-advanced-security')
    )
    .map((c) => ({
      url: c.html_url,
      file: c.path,
      line: c.line ?? c.original_line ?? null,
      headline: (c.body.split('\n').find((l) => l.trim()) ?? '(empty)')
        .replace(/^#+\s*/, '')
        .trim(),
    }));

  if (asJson) {
    console.log(
      JSON.stringify(
        { pr: number, repo, open, resolved: done, codeql },
        null,
        2
      )
    );
    return open.length === 0 ? 0 : 1;
  }

  const order = ['critical', 'security', 'bug', 'analysis', 'info', 'unmarked'];
  const rank = (f) => {
    const i = order.indexOf(f.severity);
    return i === -1 ? order.length : i;
  };

  console.log(`PR #${number} — ${repo}${title ? `\n${title}` : ''}`);
  console.log(`${open.length} open, ${done.length} resolved`);
  console.log(`checks: ${checksLine(repo, number)}\n`);

  const show = (list, heading) => {
    if (!list.length) return;
    console.log(heading);
    for (const f of [...list].sort((a, b) => rank(a) - rank(b))) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      console.log(`  ${f.emoji} ${f.headline}`);
      console.log(`     ${where}`);
      console.log(`     ${f.url}`);
    }
    console.log('');
  };

  show(open, 'OPEN');
  if (showAll) show(done, 'RESOLVED');
  if (!open.length) console.log('Nothing open.');

  if (codeql.length) {
    console.log(
      `\nCODEQL (${codeql.length}) — resolved on GitHub, not by reply`
    );
    for (const c of codeql) {
      console.log(`  🛡️  ${c.headline}`);
      console.log(`     ${c.line ? `${c.file}:${c.line}` : c.file}`);
      console.log(`     ${c.url}`);
    }
  }

  return open.length === 0 ? 0 : 1;
};

try {
  process.exit(main());
} catch (error) {
  console.error(String(error.message));
  process.exit(2);
}
