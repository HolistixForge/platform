/**
 * Pulling with a per-project credential on an engine that has no such thing.
 *
 * Apple `container` authenticates with one host-wide `registry login`. The
 * Docker path avoids that race with a throw-away `--config` directory per
 * pull; here the window is closed by a queue instead. These tests are about
 * that queue, about the credential never outliving its pull, and about the
 * preflight that keeps `container run` from having anything to pull with.
 */

import { pullAppleImage, applePreflight } from './pull-apple';
import { TResolvedImage } from './types';

const tenant: TResolvedImage = {
  imageId: 'acme:etl',
  reference: `ghcr.io/acme/etl:1.4.0@sha256:${'a'.repeat(64)}`,
  pullToken: 'project-scoped-token',
  githubOrganization: 'acme',
};

const builtin: TResolvedImage = {
  imageId: 'jupyter:minimal',
  reference: `docker.io/holistixforge/jupyterlab-minimal:1@sha256:${'b'.repeat(
    64
  )}`,
  builtin: true,
};

type TCall = { args: string[]; stdin?: string };

const recorder = (
  behaviour: (args: string[]) => string | Promise<string> = () => ''
) => {
  const calls: TCall[] = [];
  const exec = async (args: string[], stdin?: string) => {
    calls.push({ args, stdin });
    return behaviour(args);
  };
  return { calls, exec, verbs: () => calls.map((c) => c.args.join(' ')) };
};

describe('a built-in image', () => {
  it('is used as-is when it is already on the host', async () => {
    // Ours, so there is no authorization to re-check — and it is what lets a
    // platform build its own images locally rather than publishing them first.
    const { exec, verbs } = recorder(() => '{}');

    await pullAppleImage(exec, builtin);

    expect(verbs().some((v) => v.startsWith('image pull'))).toBe(false);
  });

  it('is fetched when it is not', async () => {
    const { exec, verbs } = recorder((args) => {
      if (args[1] === 'inspect') throw new Error('not found');
      return '';
    });

    await pullAppleImage(exec, builtin);

    expect(verbs()).toContain(`image pull -- ${builtin.reference}`);
  });

  it('never logs in to a registry', async () => {
    const { exec, verbs } = recorder((args) => {
      if (args[1] === 'inspect') throw new Error('not found');
      return '';
    });

    await pullAppleImage(exec, builtin);

    expect(verbs().some((v) => v.includes('registry login'))).toBe(false);
  });
});

describe('a tenant image', () => {
  it('is refused when it carries no token', async () => {
    // "No token" equally describes an image whose credential failed to mint,
    // so it is never read as "no credential needed".
    const { exec } = recorder();

    await expect(
      pullAppleImage(exec, { ...tenant, pullToken: undefined })
    ).rejects.toThrow(/needs a pull token/);
  });

  it('logs in, pulls, and logs out — in that order', async () => {
    const { exec, verbs } = recorder();

    await pullAppleImage(exec, tenant);

    const order = verbs();
    const login = order.findIndex((v) => v.startsWith('registry login'));
    const pull = order.findIndex((v) => v.startsWith('image pull'));
    const logout = order.findIndex((v) => v.startsWith('registry logout'));

    expect(login).toBeGreaterThanOrEqual(0);
    expect(pull).toBeGreaterThan(login);
    expect(logout).toBeGreaterThan(pull);
  });

  it('passes the token over stdin, never in argv', async () => {
    // An argv element is readable in `ps` by every user on the host.
    const { calls, exec } = recorder();

    await pullAppleImage(exec, tenant);

    const login = calls.find((c) => c.args[0] === 'registry');
    expect(login?.stdin).toBe('project-scoped-token');
    for (const call of calls) {
      expect(call.args.join(' ')).not.toContain('project-scoped-token');
    }
  });

  it('logs in to the registry the reference names', async () => {
    const { calls, exec } = recorder();

    await pullAppleImage(exec, tenant);

    expect(calls[0].args).toEqual([
      'registry',
      'login',
      '--username',
      'x-access-token',
      '--password-stdin',
      '--',
      'ghcr.io',
    ]);
  });

  it('is pulled again on every start, cached or not', async () => {
    // The layer cache belongs to the host and the credential to one project.
    // If "already present" meant "nothing to do", another project could name
    // the same digest and get it without proving access.
    const { exec, verbs } = recorder();

    await pullAppleImage(exec, tenant);
    await pullAppleImage(exec, tenant);

    expect(verbs().filter((v) => v.startsWith('image pull'))).toHaveLength(2);
  });

  it('logs out even when the pull fails', async () => {
    // A login left behind is an ambient credential, and under this engine a
    // run will pull with one.
    const { exec, verbs } = recorder((args) => {
      if (args[0] === 'image') throw new Error('unauthorized');
      return '';
    });

    await expect(pullAppleImage(exec, tenant)).rejects.toThrow('unauthorized');

    expect(verbs().some((v) => v.startsWith('registry logout'))).toBe(true);
  });

  it('logs out even when the login itself fails', async () => {
    const { exec, verbs } = recorder((args) => {
      if (args[1] === 'login') throw new Error('bad credentials');
      return '';
    });

    await expect(pullAppleImage(exec, tenant)).rejects.toThrow(
      /bad credentials/
    );

    expect(verbs().some((v) => v.startsWith('registry logout'))).toBe(true);
  });

  it('names the likely cause when login is refused', async () => {
    // Measured against real GHCR: `registry login` performs the registry's
    // own token exchange, so it works with a GitHub credential and refuses an
    // already-exchanged one — and `ghcrPullToken` hands over exactly that, a
    // repository-scoped bearer. The same bearer answers 200 on /v2/ when sent
    // as `Bearer` and 401 through login.
    //
    // A bare "401 unauthorized" sends the next person to check the password.
    const { exec } = recorder((args) => {
      if (args[1] === 'login') throw new Error('401 Unauthorized');
      return '';
    });

    await expect(pullAppleImage(exec, tenant)).rejects.toThrow(
      /result of an exchange/
    );
  });
});

describe('two tenant pulls at once', () => {
  it('never overlap, so one project cannot pull under the other login', async () => {
    // This is the whole reason for the queue. The login is host-wide, so an
    // interleaving would let project B's pull run while project A's credential
    // is the one installed.
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const exec = async (args: string[]) => {
      const verb = `${args[0]} ${args[1]}`;
      order.push(`${verb}`);
      if (args[0] === 'image' && !releaseFirst) {
        // Hold the first pull open until the second has had every chance to
        // start.
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return '';
    };

    const first = pullAppleImage(exec, tenant);
    const second = pullAppleImage(exec, {
      ...tenant,
      imageId: 'other:image',
      pullToken: 'another-projects-token',
    });

    // Let the microtask queue drain: without serialisation the second login
    // would already be recorded by now.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order.filter((v) => v === 'registry login')).toHaveLength(1);

    releaseFirst?.();
    await Promise.all([first, second]);

    // The first pull is fully wound up — logout included — before the second
    // one authenticates.
    expect(order.indexOf('registry logout')).toBeLessThan(
      order.lastIndexOf('registry login')
    );
  });

  it('keeps the queue alive after one of them fails', async () => {
    let attempt = 0;
    const exec = async (args: string[]) => {
      if (args[0] === 'image') {
        attempt += 1;
        if (attempt === 1) throw new Error('unauthorized');
      }
      return '';
    };

    const failing = pullAppleImage(exec, tenant);
    const following = pullAppleImage(exec, tenant);

    await expect(failing).rejects.toThrow('unauthorized');
    await expect(following).resolves.toBeUndefined();
  });
});

describe('applePreflight', () => {
  it('lets the broker start on a host with no registry logins', async () => {
    const exec = async () => '[]';
    await expect(applePreflight(exec)).resolves.toBeUndefined();
  });

  it('refuses to start while a login exists, and names it', async () => {
    // `container run` fetches a missing image by itself — measured. That is
    // only harmless while there is no credential for it to fetch with.
    //
    // The payload is the real one: `container registry list --format json`
    // carries `name` and `id`, not `host`. Guessing produced "holds registry
    // logins (unnamed)", which is a refusal nobody can act on — and most of
    // the value of refusing is telling the operator what to clear.
    const exec = async () =>
      JSON.stringify([
        {
          creationDate: '2026-08-05T10:58:34Z',
          id: 'ghcr.io',
          labels: {},
          name: 'ghcr.io',
          username: 'someone',
        },
      ]);

    await expect(applePreflight(exec)).rejects.toThrow(/ghcr\.io/);
    await expect(applePreflight(exec)).rejects.toThrow(/registry logout/);
  });

  it('never says "unnamed" for a login it can see', async () => {
    // A field rename upstream must degrade to naming one host rather than
    // none: an unactionable refusal is the failure this test exists against.
    const exec = async () => JSON.stringify([{ host: 'registry.example' }]);

    await expect(applePreflight(exec)).rejects.toThrow(/registry\.example/);
  });

  it('does not block on a CLI that cannot list logins', async () => {
    // An older `container` without `registry list --format json` should not
    // stop a deployment; it should not silently claim a clean host either,
    // which is why the refusal only triggers on a login it actually read.
    const exec = async () => {
      throw new Error('unknown subcommand');
    };
    await expect(applePreflight(exec)).resolves.toBeUndefined();
  });
});
