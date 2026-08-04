import { spawn } from 'node:child_process';
import { Command } from 'commander';

import {
  clearCredentials,
  credentialsPath,
  readCredentials,
  writeCredentials,
} from './lib/credentials';
import { disconnect, enrol, whoAmI } from './lib/enrol';

/**
 * The Holistix local runner — headless.
 *
 * Local mode used to hand out a `docker run` to paste, and the platform lost
 * the thread the moment it did: it could not stop, restart or reconcile
 * anything it had told someone to type. This is the other half — a worker
 * enrolled once, which the platform then drives.
 *
 * This build covers enrolment and identity. The worker loop (heartbeat,
 * placements, Ansible) comes next and needs what is here: nothing can be
 * driven before the machine has a name the platform trusts.
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
