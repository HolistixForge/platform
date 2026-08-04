import { fetchProjects, RunnerRevoked } from './projects';
import { sendHeartbeat, sendHeartbeats } from './heartbeat';

const credentials = {
  ganymedeUrl: 'http://ganymede.test',
  runner_id: 'runner-1',
  label: 'laptop',
  token: 'a-runner-token',
};

const project = {
  project_id: 'project-1',
  project_name: 'Thing',
  organization_id: 'org-1',
  gateway_hostname: 'org-org-1.apollo.local',
  token: 'a-project-token',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('fetchProjects', () => {
  it('should ask with the runner token and return what it is in', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () =>
      json({ projects: [project] })
    ) as unknown as typeof fetch;

    // Act
    const projects = await fetchProjects(credentials, fetchImpl);

    // Assert
    expect(projects).toEqual([project]);
    expect(jest.mocked(fetchImpl).mock.calls[0][0]).toBe(
      'http://ganymede.test/runners/me/projects'
    );
    expect(
      (
        jest.mocked(fetchImpl).mock.calls[0][1]?.headers as Record<
          string,
          string
        >
      ).authorization
    ).toBe('Bearer a-runner-token');
  });

  it('should treat an empty list as a machine in no project yet', async () => {
    // Arrange - freshly enrolled, nobody has placed anything on it
    const fetchImpl = (async () =>
      json({ projects: [] })) as unknown as typeof fetch;

    // Act / Assert - not an error; there is simply nothing to do
    await expect(fetchProjects(credentials, fetchImpl)).resolves.toEqual([]);
  });

  it('should raise RunnerRevoked rather than a generic failure', async () => {
    // Arrange - somebody disconnected this machine
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;

    // Act / Assert - distinguished so the loop can stop instead of retrying
    // forever against a door that is now closed
    await expect(fetchProjects(credentials, fetchImpl)).rejects.toThrow(
      RunnerRevoked
    );
  });

  it('should not mistake a platform outage for a revocation', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 503)) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchProjects(credentials, fetchImpl)).rejects.not.toThrow(
      RunnerRevoked
    );
  });
});

describe('sendHeartbeat', () => {
  it('should post the health event to that project’s gateway', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () => json({})) as unknown as typeof fetch;

    // Act
    const result = await sendHeartbeat(
      project,
      'machine-1',
      'laptop',
      fetchImpl
    );

    // Assert
    expect(result).toEqual({ project_id: 'project-1', ok: true });
    expect(jest.mocked(fetchImpl).mock.calls[0][0]).toBe(
      'https://org-org-1.apollo.local/collab/event'
    );
  });

  it('should present the project token, not the enrolment one', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () => json({})) as unknown as typeof fetch;

    // Act
    await sendHeartbeat(project, 'machine-1', 'laptop', fetchImpl);

    // Assert - the enrolment token speaks for the machine everywhere; this one
    // speaks for one project, which is the point of minting it per project
    const init = jest.mocked(fetchImpl).mock.calls[0][1];
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer a-project-token'
    );
  });

  it('should not put the owner in the event', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () => json({})) as unknown as typeof fetch;

    // Act
    await sendHeartbeat(project, 'machine-1', 'laptop', fetchImpl);

    // Assert - the gateway takes the owner from the authenticated token; a
    // runner that could name its own owner could enrol itself into a project
    // it was never invited to
    const body = JSON.parse(
      String(jest.mocked(fetchImpl).mock.calls[0][1]?.body)
    );
    expect(body.event).toEqual({
      type: 'user-container:runner-health',
      machine_id: 'machine-1',
      label: 'laptop',
      systemEvent: true,
    });
    expect(body.event).not.toHaveProperty('user_id');
  });

  it('should report a refusal without throwing', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;

    // Act
    const result = await sendHeartbeat(
      project,
      'machine-1',
      'laptop',
      fetchImpl
    );

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/403/);
  });

  it('should survive a gateway that is simply not there', async () => {
    // Arrange - the organization was stopped for inactivity
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    // Act
    const result = await sendHeartbeat(
      project,
      'machine-1',
      'laptop',
      fetchImpl
    );

    // Assert
    expect(result).toMatchObject({ ok: false, error: 'ECONNREFUSED' });
  });
});

describe('sendHeartbeats', () => {
  it('should keep beating to the others when one gateway is down', async () => {
    // Arrange
    const second = {
      ...project,
      project_id: 'project-2',
      gateway_hostname: 'down.local',
    };
    const fetchImpl = (async (url: string) => {
      if (url.includes('down.local')) throw new Error('ECONNREFUSED');
      return json({});
    }) as unknown as typeof fetch;

    // Act
    const results = await sendHeartbeats(
      [project, second],
      'machine-1',
      'laptop',
      fetchImpl
    );

    // Assert - a machine in four projects must not go quiet in all of them
    // because one was unreachable
    expect(results).toEqual([
      { project_id: 'project-1', ok: true },
      expect.objectContaining({ project_id: 'project-2', ok: false }),
    ]);
  });
});
