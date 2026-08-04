/**
 * Pull tests.
 *
 * A pull credential belongs to one project, and the image cache belongs to the
 * whole host. These tests pin the two consequences: credentials never touch
 * shared state, and a cached image still costs a trip to the registry.
 */

import { readFile, access } from 'node:fs/promises';
import { pullImage, registryHost } from './pull';
import { TResolvedImage } from './types';

const reference = `ghcr.io/acme/etl:1.4.0@sha256:${'a'.repeat(64)}`;

/** Record every argv the runtime was called with. */
const recorder = () => {
  const calls: string[][] = [];
  return {
    calls,
    exec: async (args: string[]) => {
      calls.push(args);
      return 'container-id';
    },
  };
};

describe('registryHost', () => {
  it.each([
    ['ghcr.io/acme/etl:1.0', 'ghcr.io'],
    [`ghcr.io/acme/etl@sha256:${'a'.repeat(64)}`, 'ghcr.io'],
    ['registry.example.com:5000/team/app:1.0', 'registry.example.com:5000'],
    ['localhost/dev/app:1.0', 'localhost'],
    // No dot and no colon in the first segment: a Docker Hub namespace, not a
    // host — the one case where the reference names no registry.
    ['holistixforge/ubuntu-terminal:24.04', 'docker.io'],
  ])('reads %s as %s', (ref, expected) => {
    expect(registryHost(ref)).toBe(expected);
  });
});

describe('pullImage', () => {
  it('pulls before the container is ever run', async () => {
    const { calls, exec } = recorder();

    await pullImage(exec, { imageId: 'acme:etl', reference, pullToken: 'tok' });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('pull');
    expect(calls[0][calls[0].length - 1]).toBe(reference);
  });

  it('gives the pull its own config directory', async () => {
    // `docker login` writes to a config shared by every pull on this host, so
    // two projects pulling at once race and the last writer lends its access
    // to the other.
    const { calls, exec } = recorder();

    await pullImage(exec, { imageId: 'acme:etl', reference, pullToken: 'tok' });

    const configIndex = calls[0].indexOf('--config');
    expect(configIndex).toBe(0);
    expect(calls[0][configIndex + 1]).toMatch(/holistix-pull-/);
  });

  it('writes the token into that directory and nowhere else', async () => {
    let configDir: string | undefined;
    const exec = async (args: string[]) => {
      configDir = args[args.indexOf('--config') + 1];
      const written = JSON.parse(
        await readFile(`${configDir}/config.json`, 'utf8')
      );
      expect(written.auths['ghcr.io'].auth).toBe(
        Buffer.from('x-access-token:tok').toString('base64')
      );
      return '';
    };

    await pullImage(exec, { imageId: 'acme:etl', reference, pullToken: 'tok' });
    expect(configDir).toBeDefined();
  });

  it('removes the credential directory afterwards', async () => {
    let configDir = '';
    const exec = async (args: string[]) => {
      configDir = args[args.indexOf('--config') + 1];
      return '';
    };

    await pullImage(exec, { imageId: 'acme:etl', reference, pullToken: 'tok' });

    await expect(access(configDir)).rejects.toThrow();
  });

  it('removes the credential directory even when the pull fails', async () => {
    // A credential left in /tmp outlives the request that needed it.
    let configDir = '';
    const exec = async (args: string[]) => {
      configDir = args[args.indexOf('--config') + 1];
      throw new Error('manifest unknown');
    };

    await expect(
      pullImage(exec, { imageId: 'acme:etl', reference, pullToken: 'tok' })
    ).rejects.toThrow('manifest unknown');

    await expect(access(configDir)).rejects.toThrow();
  });

  describe('built-in images', () => {
    const builtin: TResolvedImage = {
      imageId: 'ubuntu:terminal',
      reference: 'holistixforge/ubuntu-terminal:24.04',
      builtin: true,
    };

    it('uses no credential', async () => {
      // Ours, not a tenant's — there is no project token involved.
      const { calls, exec } = recorder();

      await pullImage(exec, builtin);

      expect(calls.some((c) => c.includes('--config'))).toBe(false);
    });

    it('is used as-is when already on the host', async () => {
      // The always-pull rule guards an access decision, and a built-in carries
      // none. Skipping the fetch is also what lets a platform build its own
      // images locally rather than having to publish them first.
      const calls: string[][] = [];
      const exec = async (args: string[]) => {
        calls.push(args);
        return args[0] === 'images' ? 'sha256:abc123' : '';
      };

      await pullImage(exec, builtin);

      expect(calls.some((c) => c.includes('pull'))).toBe(false);
    });

    it('is fetched when absent', async () => {
      const calls: string[][] = [];
      const exec = async (args: string[]) => {
        calls.push(args);
        // `docker images --quiet` answers empty for an image not on the host.
        return args[0] === 'images' ? '' : '';
      };

      await pullImage(exec, builtin);

      expect(calls.at(-1)).toEqual(['pull', '--', builtin.reference]);
    });
  });

  it('refuses a tenant image that carries no pull token', async () => {
    // Not a built-in and no credential: something upstream failed to mint one,
    // and pulling anonymously would either fail obscurely or — worse — succeed
    // from the shared layer cache.
    const { exec } = recorder();

    await expect(
      pullImage(exec, { imageId: 'acme:etl', reference })
    ).rejects.toThrow('needs a pull token');
  });
});
