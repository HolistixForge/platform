import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  clearCredentials,
  credentialsPath,
  readCredentials,
  writeCredentials,
} from './credentials';

const credentials = {
  ganymedeUrl: 'https://apollo.local',
  runner_id: '7f1d0b9c-2b3a-4a5e-9c6d-8e0f1a2b3c4d',
  label: 'laptop',
  token: 'a.runner.token',
};

describe('credentials', () => {
  let path: string;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'holistix-runner-'));
    path = join(dir, 'nested', 'runner.json');
  });

  it('should round-trip what login produced', async () => {
    // Act
    await writeCredentials(credentials, path);

    // Assert
    await expect(readCredentials(path)).resolves.toEqual(credentials);
  });

  it('should create the file readable only by its owner', async () => {
    // Act
    await writeCredentials(credentials, path);

    // Assert - a year-long token on a shared machine is a machine anyone with
    // an account there can place services on
    const mode = (await stat(path)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('should tighten the mode of a file that already existed', async () => {
    // Arrange - an earlier version, or a hand-edited file
    await writeCredentials(credentials, path);
    const { chmod } = await import('node:fs/promises');
    await chmod(path, 0o644);

    // Act
    await writeCredentials({ ...credentials, label: 'desktop' }, path);

    // Assert - mode on writeFile applies at creation only, so this needs the
    // explicit chmod that follows it
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('should report no credentials when the file is absent', async () => {
    // Act / Assert
    await expect(readCredentials(path)).resolves.toBeUndefined();
  });

  it('should report no credentials for an unreadable file', async () => {
    // Arrange - interrupted write, or a file someone edited
    await writeCredentials(credentials, path);
    await writeFile(path, '{ not json');

    // Act / Assert
    await expect(readCredentials(path)).resolves.toBeUndefined();
  });

  it('should refuse a token with no runner id beside it', async () => {
    // Arrange - such a token cannot be matched to anything in the owner's
    // machine list, so it cannot be revoked from there either
    await writeFile(
      path.replace('nested/', ''),
      JSON.stringify({ token: 'x' })
    );

    // Act / Assert
    await expect(
      readCredentials(path.replace('nested/', ''))
    ).resolves.toBeUndefined();
  });

  it('should remove the file on disconnect, and not mind if it is gone', async () => {
    // Arrange
    await writeCredentials(credentials, path);

    // Act
    await clearCredentials(path);
    await clearCredentials(path);

    // Assert
    await expect(readCredentials(path)).resolves.toBeUndefined();
  });

  describe('credentialsPath', () => {
    afterEach(() => delete process.env.HOLISTIX_RUNNER_HOME);

    it('should default under the home directory', () => {
      // Act / Assert
      expect(credentialsPath()).toMatch(/\.holistix[/\\]runner\.json$/);
    });

    it('should honour HOLISTIX_RUNNER_HOME', () => {
      // Arrange - several runners on one machine, or a service account
      process.env.HOLISTIX_RUNNER_HOME = '/tmp/elsewhere';

      // Act / Assert
      expect(credentialsPath()).toBe('/tmp/elsewhere/runner.json');
    });
  });
});

describe('the token never reaches the environment', () => {
  it('should not be readable from process.env after a write', async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), 'holistix-runner-'));
    const path = join(dir, 'runner.json');

    // Act
    await writeCredentials(credentials, path);

    // Assert - an env var is inherited by every child this runner spawns,
    // which includes every container it starts
    expect(JSON.stringify(process.env)).not.toContain(credentials.token);
    expect(await readFile(path, 'utf8')).toContain(credentials.token);
  });
});
