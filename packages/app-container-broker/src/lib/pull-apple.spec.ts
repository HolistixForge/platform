import { createHash } from 'node:crypto';
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

/**
 * A tenant image is fetched by the broker and handed to the engine as bytes.
 *
 * Not through `registry login`: that performs the registry's token exchange,
 * and Ganymede sends the result of an exchange rather than a credential — so
 * login refuses it, measured, while the same token answers 200 as a `Bearer`.
 * Holding the bearer here means no credential is ever installed on the host.
 */

const sha = (bytes: Uint8Array) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

const bytesOf = (value: unknown) =>
  new TextEncoder().encode(
    typeof value === 'string' ? value : JSON.stringify(value)
  );

// Built bottom-up so every digest is the real one: the traversal verifies each
// body against the digest that named it, which a stub with invented digests
// could never get past — and that check is most of what this file is about.
const CONFIG_BYTES = bytesOf('config');
const LAYER_BYTES = bytesOf('layer');
const CONFIG_DIGEST = sha(CONFIG_BYTES);
const LAYER_DIGEST = sha(LAYER_BYTES);

const MANIFEST_BYTES = bytesOf({
  mediaType: 'application/vnd.oci.image.manifest.v1+json',
  config: { digest: CONFIG_DIGEST },
  layers: [{ digest: LAYER_DIGEST }],
});
const MANIFEST_DIGEST = sha(MANIFEST_BYTES);

const INDEX_BYTES = bytesOf({
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [{ digest: MANIFEST_DIGEST }],
});
const INDEX_DIGEST = sha(INDEX_BYTES);

/** A registry that answers correctly, and records what was asked of it. */
const registry = () => {
  const asked: { url: string; auth?: string }[] = [];
  const bodies: Record<string, Uint8Array> = {
    [INDEX_DIGEST]: INDEX_BYTES,
    [MANIFEST_DIGEST]: MANIFEST_BYTES,
    [CONFIG_DIGEST]: CONFIG_BYTES,
    [LAYER_DIGEST]: LAYER_BYTES,
  };
  const fetchBlob = async (url: string, headers: Record<string, string>) => {
    asked.push({ url, auth: headers.Authorization });
    const digest = Object.keys(bodies).find((d) => url.endsWith(d));
    return digest
      ? { ok: true, status: 200, bytes: bodies[digest] }
      : { ok: false, status: 404, bytes: new Uint8Array() };
  };
  return { asked, bodies, fetchBlob };
};

const digestPinned: TResolvedImage = {
  imageId: 'acme:etl',
  reference: `ghcr.io/acme/etl:1.4.0@${INDEX_DIGEST}`,
  pullToken: 'project-scoped-token',
  githubOrganization: 'acme',
};

describe('a tenant image', () => {
  it('is refused when it carries no token', async () => {
    // "No token" equally describes an image whose credential failed to mint,
    // so it is never read as "no credential needed".
    const { exec } = recorder();
    const { fetchBlob } = registry();

    await expect(
      pullAppleImage(exec, { ...digestPinned, pullToken: undefined }, fetchBlob)
    ).rejects.toThrow(/needs a pull token/);
  });

  it('spends the bearer on the registry, never on the engine', async () => {
    const { calls, exec } = recorder();
    const { asked, fetchBlob } = registry();

    await pullAppleImage(exec, digestPinned, fetchBlob);

    expect(asked.every((a) => a.auth === 'Bearer project-scoped-token')).toBe(
      true
    );
    for (const call of calls) {
      expect(call.args.join(' ')).not.toContain('project-scoped-token');
      expect(call.stdin ?? '').not.toContain('project-scoped-token');
    }
  });

  it('never logs in, so no credential lands on the host', async () => {
    // The window this closes is the one a queue used to serialise: a host-wide
    // login means one pull's token is installed while another could use it.
    const { calls, exec } = recorder();
    const { fetchBlob } = registry();

    await pullAppleImage(exec, digestPinned, fetchBlob);

    expect(calls.map((c) => c.args.join(' ')).join('|')).not.toContain(
      'registry'
    );
  });

  it('walks the index down to every blob', async () => {
    const { exec } = recorder();
    const { asked, fetchBlob } = registry();

    await pullAppleImage(exec, digestPinned, fetchBlob);

    for (const d of [
      INDEX_DIGEST,
      MANIFEST_DIGEST,
      CONFIG_DIGEST,
      LAYER_DIGEST,
    ]) {
      expect(asked.some((a) => a.url.endsWith(d))).toBe(true);
    }
  });

  it('hands the engine an archive rather than a reference', async () => {
    const { calls, exec } = recorder();
    const { fetchBlob } = registry();

    await pullAppleImage(exec, digestPinned, fetchBlob);

    const load = calls.find((c) => c.args[1] === 'load');
    expect(load?.args[0]).toBe('image');
    expect(load?.args[2]).toBe('--input');
    expect(load?.args[3]).toMatch(/holistix-oci-.*image\.tar$/);
  });

  it('refuses bytes that do not match the digest that named them', async () => {
    // The whole point of pinning a digest. A registry answering with something
    // else is refused here rather than started.
    const { exec } = recorder();
    const { bodies, fetchBlob } = registry();
    bodies[LAYER_DIGEST] = bytesOf('something else entirely');

    await expect(pullAppleImage(exec, digestPinned, fetchBlob)).rejects.toThrow(
      /answered sha256:.*, not/
    );
  });

  it('refuses a reference that is not pinned at all', async () => {
    const { exec } = recorder();
    const { fetchBlob } = registry();

    await expect(
      pullAppleImage(
        exec,
        { ...digestPinned, reference: 'ghcr.io/acme/etl:1.4.0' },
        fetchBlob
      )
    ).rejects.toThrow(/not digest-pinned/);
  });

  it('is fetched again on every start, cached or not', async () => {
    // The layer cache belongs to the host and the credential to one project.
    // If "already present" meant "nothing to do", another project could name
    // the same digest and get it without proving access.
    const { exec } = recorder();
    const { asked, fetchBlob } = registry();

    await pullAppleImage(exec, digestPinned, fetchBlob);
    await pullAppleImage(exec, digestPinned, fetchBlob);

    expect(asked.filter((a) => a.url.endsWith(INDEX_DIGEST))).toHaveLength(2);
  });

  it('does not load anything when the registry refuses', async () => {
    const { calls, exec } = recorder();
    const fetchBlob = async () => ({
      ok: false,
      status: 401,
      bytes: new Uint8Array(),
    });

    await expect(pullAppleImage(exec, digestPinned, fetchBlob)).rejects.toThrow(
      /refused/
    );

    expect(calls.some((c) => c.args[1] === 'load')).toBe(false);
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
