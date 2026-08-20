import { spawn } from 'node:child_process';
import { Command } from 'commander';

import {
  clearCredentials,
  credentialsPath,
  readCredentials,
  writeCredentials,
} from './lib/credentials';
import { disconnect, enrol, whoAmI } from './lib/enrol';
import { fetchWithHint } from './lib/fetch-hint';
import { dockerExec } from './lib/docker';
import { selectEngine } from './lib/engine';
import { appleEngine } from './lib/engine-apple';
import { dockerEngine } from './lib/engine-docker';
import { defaultReconcile, run, runOnce } from './lib/loop';

/**
 * The Holistix local runner — headless.
 *
 * Local mode used to hand out a `docker run` to paste, and the platform lost
 * the thread the moment it did: it could not stop, restart or reconcile
 * anything it had told someone to type. This is the other half — a worker
 * enrolled once, which the platform then drives.
 *
 * `login` enrols the machine; `run` keeps it announced and its services in
 * line. A pass asks Ganymede which projects this machine is in, announces
 * itself to each project's gateway, asks that gateway what it placed here, and
 * reconciles Docker against the answer.
 */

const openInBrowser = async (url: string): Promise<void> => {
  // Printed first and unconditionally: over SSH, in a container, or on a
  // server with no browser at all, the URL in the terminal is the whole flow.
  // The loopback redirect still works — the person opens it wherever they are,
  // and only the final hop has to reach 127.0.0.1 on this machine.
  console.log(`\nOpen this URL to sign in:\n  ${url}\n`);

  // A headless box has no opener, and on one that does, spawning a browser
  // nobody asked for is worse than printing a line.
  if (process.env.HOLISTIX_NO_BROWSER) return;

  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  const child = spawn(opener, [url], { stdio: 'ignore', detached: true });
  // A missing opener is the normal case on a server, not a failure worth
  // stopping an enrolment for — the URL is already on screen.
  child.on('error', () => undefined);
  child.unref();
};

// Every request this binary makes, with the reason attached when it fails.
//
// Installed on the global rather than threaded through `enrol`, `whoAmI`,
// `disconnect`, `runOnce`, `run` and `defaultReconcile` — six call sites, all
// of which default to the global today, and a seventh added later would be
// silently left out. This is the process's own entry point, which is the one
// place where replacing its fetch is a decision rather than a surprise.
//
// `fetchWithHint` only ever adds a sentence and rethrows; it never swallows an
// error and never changes a response, so nothing downstream reads differently.
globalThis.fetch = fetchWithHint;

const program = new Command();

program
  .name('holistix-runner')
  .description('Run Holistix project services on this machine')
  .version('0.0.1');

program
  .command('login')
  .description('Enrol this machine with a Holistix instance')
  .requiredOption(
    '-u, --url <url>',
    'Ganymede URL, e.g. https://apollo.local',
    process.env.HOLISTIX_URL
  )
  .option('-l, --label <label>', 'Name shown in your machine list')
  .action(async (options: { url: string; label?: string }) => {
    const existing = await readCredentials();
    if (existing) {
      // Enrolling twice would leave the first runner in the owner's list with
      // nothing answering for it — a machine that looks available and is not.
      console.error(
        `This machine is already enrolled as "${existing.label}" (${existing.runner_id}).\n` +
          `Run "holistix-runner disconnect" first.`
      );
      process.exitCode = 1;
      return;
    }

    console.log('Opening your browser to sign in to Holistix…');

    const credentials = await enrol({
      ganymedeUrl: options.url,
      label: options.label,
      openBrowser: openInBrowser,
    });

    await writeCredentials(credentials);

    console.log(
      `\nEnrolled as "${credentials.label}" (${credentials.runner_id}).\n` +
        `Token stored in ${credentialsPath()} (readable only by you).\n` +
        `Revoke it any time from Holistix, or with "holistix-runner disconnect".`
    );
  });

program
  .command('status')
  .description('Ask Holistix whether this machine is still enrolled')
  .action(async () => {
    const credentials = await readCredentials();
    if (!credentials) {
      console.log('Not enrolled. Run "holistix-runner login".');
      process.exitCode = 1;
      return;
    }

    const me = await whoAmI(credentials);
    if (!me) {
      // Not an error on this side: somebody revoked this machine, which is
      // exactly what the button is for.
      console.log(
        `Revoked. "${credentials.label}" (${credentials.runner_id}) is no longer enrolled at ${credentials.ganymedeUrl}.\n` +
          `Run "holistix-runner login" to enrol again.`
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `Enrolled at ${credentials.ganymedeUrl}\n` +
        `  machine  ${me.label} (${me.runner_id})\n` +
        `  owner    ${me.user_id}`
    );
  });

program
  .command('run')
  .description('Stay up, announce this machine, and keep its services in line')
  .option('--once', 'One pass and exit — for a cron, or for looking at it')
  .option(
    '-i, --interval <seconds>',
    'Seconds between passes',
    (v) => Number(v) * 1000,
    15_000
  )
  .action(async (options: { once?: boolean; interval: number }) => {
    const credentials = await readCredentials();
    if (!credentials) {
      console.error('Not enrolled. Run "holistix-runner login" first.');
      process.exitCode = 1;
      return;
    }

    // Named by the environment, never sniffed from what is installed: a
    // machine with both would get whichever the PATH happened to offer, and
    // the two do not isolate the same way. On macOS this is `apple` — there is
    // no Docker there at all, and a pass would stop at "cannot connect to the
    // Docker daemon".
    const engine = selectEngine(process.env.RUNNER_ENGINE, {
      docker: dockerEngine,
      apple: appleEngine,
    });
    const reconcileProject = defaultReconcile(
      credentials,
      engine,
      dockerExec(process.env.RUNNER_ENGINE_BINARY || engine.binary)
    );

    if (engine.concessions.length) {
      console.log(
        `Engine ${engine.name}. Controls it cannot express: ${engine.concessions
          .map((c) => c.id)
          .join(', ')}`
      );
    }

    if (options.once) {
      const result = await runOnce({ credentials, reconcileProject });
      if (result.revoked) {
        console.error('This machine is no longer enrolled.');
        process.exitCode = 1;
        return;
      }
      console.log(
        `${result.projects} project(s) · ${result.heartbeats.ok} announced, ${result.heartbeats.failed} unreachable`
      );
      return;
    }

    // SIGINT and SIGTERM both resolve the same promise: a runner under a
    // service manager and one someone pressed ctrl-c on should stop the same
    // way, mid-wait rather than at the end of the interval.
    const stop = new Promise<void>((resolve) => {
      const finish = () => {
        console.log('\nStopping.');
        resolve();
      };
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
    });

    await run({
      credentials,
      reconcileProject,
      intervalMs: options.interval,
      stop,
    });
  });

program
  .command('disconnect')
  .description('Withdraw this machine and delete its token')
  .action(async () => {
    const credentials = await readCredentials();
    if (!credentials) {
      console.log('Not enrolled; nothing to disconnect.');
      return;
    }

    const revoked = await disconnect(credentials);
    // The local file goes either way: leaving a revoked token on disk only
    // makes the next login refuse to start.
    await clearCredentials();

    console.log(
      revoked
        ? `Disconnected "${credentials.label}" from ${credentials.ganymedeUrl}.`
        : `"${credentials.label}" was already revoked; local token removed.`
    );
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
