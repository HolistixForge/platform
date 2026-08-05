import { fetchPlacements } from './placements';
import { TRunnerProject } from './projects';

const project: TRunnerProject = {
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

describe('fetchPlacements', () => {
  it('should ask that project’s gateway with that project’s token', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () =>
      json({ placements: [] })
    ) as unknown as typeof fetch;

    // Act
    await fetchPlacements(project, fetchImpl);

    // Assert - the enrolment token speaks for the machine everywhere; this one
    // speaks for one project, and the gateway filters on what it names
    const [url, init] = jest.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe(
      'https://org-org-1.apollo.local/placements?project_id=project-1'
    );
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer a-project-token'
    );
  });

  it('should never send a machine id of its own choosing', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () =>
      json({ placements: [] })
    ) as unknown as typeof fetch;

    // Act
    await fetchPlacements(project, fetchImpl);

    // Assert - a runner able to name a machine could ask for somebody else's
    // placements and start their services on its own
    const [url] = jest.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).not.toMatch(/machine/i);
  });

  it('should treat no placements as a normal answer', async () => {
    // Arrange - in the project, nothing placed on this machine yet
    const fetchImpl = (async () =>
      json({ placements: [] })) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchPlacements(project, fetchImpl)).resolves.toEqual([]);
  });

  it('should tolerate a response with no placements key at all', async () => {
    // Arrange
    const fetchImpl = (async () => json({})) as unknown as typeof fetch;

    // Act / Assert - an empty list beats a crash in a loop that must survive
    await expect(fetchPlacements(project, fetchImpl)).resolves.toEqual([]);
  });

  it('should say which project failed', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 503)) as unknown as typeof fetch;

    // Act / Assert - the loop reconciles several projects and logs per project;
    // an error naming none of them is one nobody can act on
    await expect(fetchPlacements(project, fetchImpl)).rejects.toThrow(/Thing/);
  });
});
