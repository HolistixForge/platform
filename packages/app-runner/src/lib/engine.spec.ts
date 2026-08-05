import { appleEngine } from './engine-apple';
import { dockerEngine } from './engine-docker';
import { selectEngine, UnsupportedByEngine } from './engine';
import {
  LABEL_CONTAINER,
  LABEL_MACHINE,
  LABEL_PROJECT,
  TDockerExec,
} from './docker';
import { TPlacement } from './placement';

const engines = { docker: dockerEngine, apple: appleEngine };

const placement = (over: Partial<TPlacement> = {}): TPlacement =>
  ({
    project_id: 'proj-1',
    user_container_id: 'uc_1',
    machine_id: 'machine-1',
    name: 'holistix_svc_uc_1',
    imageRef: 'ghcr.io/acme/etl@sha256:' + 'a'.repeat(64),
    settings: 'c2V0dGluZ3M=',
    capabilities: ['NET_ADMIN'],
    devices: ['/dev/net/tun'],
    extraHosts: [{ host: 'ganymede.test', ip: '172.17.0.1' }],
    networks: ['net-a', 'net-b'],
    ...over,
  } as TPlacement);

describe('selectEngine', () => {
  it('defaults to docker, which is what every existing runner has', () => {
    expect(selectEngine(undefined, engines).name).toBe('docker');
    expect(selectEngine('', engines).name).toBe('docker');
  });

  it('takes the engine it is told, whatever case it is written in', () => {
    expect(selectEngine('Apple', engines).name).toBe('apple');
  });

  it('refuses a name it does not know rather than falling back', () => {
    // Falling back would run somebody's container under an isolation they did
    // not ask for, because of a typo.
    expect(() => selectEngine('podman', engines)).toThrow(
      /Unknown container engine/
    );
  });
});

describe('appleEngine — what it cannot do', () => {
  it('refuses to attach a network to a running container', async () => {
    // The caller recreates instead. A silent no-op would leave the container
    // on the wrong network while the pass reported success.
    await expect(
      appleEngine.connectNetwork((async () => '') as TDockerExec, 'net', 'id')
    ).rejects.toBeInstanceOf(UnsupportedByEngine);
  });

  it('names every control it gives up', () => {
    expect(appleEngine.concessions.map((c) => c.id).sort()).toEqual([
      'no-add-host',
      'no-hot-network-attach',
      'restart-policy',
    ]);
    for (const c of appleEngine.concessions) {
      expect(c.control).toBeTruthy();
      expect(c.lost).toBeTruthy();
    }
  });

  it('claims its own kernel, where docker claims nothing', () => {
    expect(appleEngine.isMicroVm).toBe(true);
    expect(dockerEngine.isMicroVm).toBe(false);
    expect(dockerEngine.concessions).toEqual([]);
  });
});

describe('appleEngine.runArgs', () => {
  const args = appleEngine.runArgs(placement(), 'machine-1');

  it('passes no host device', () => {
    // The guest kernel already has /dev/net/tun — measured in a running
    // container. Handing over the host's node would be meaningless here.
    expect(args).not.toContain('--device');
    expect(args.join(' ')).not.toContain('/dev/net/tun');
  });

  it('passes no restart policy, because there is none', () => {
    expect(args).not.toContain('--restart');
  });

  it('passes no extra hosts, because the flag does not exist', () => {
    expect(args).not.toContain('--add-host');
  });

  it('still labels the container, or the next pass cannot find it', () => {
    expect(args).toContain(`${LABEL_PROJECT}=proj-1`);
    expect(args).toContain(`${LABEL_CONTAINER}=uc_1`);
    expect(args).toContain(`${LABEL_MACHINE}=machine-1`);
  });

  it('still carries the settings blob and the capability', () => {
    expect(args).toContain('SETTINGS=c2V0dGluZ3M=');
    expect(args).toContain('--cap-add');
    expect(args).toContain('NET_ADMIN');
  });

  it('gives only the first network at creation', () => {
    expect(args.filter((a) => a === '--network')).toHaveLength(1);
    expect(args).toContain('net-a');
    expect(args).not.toContain('net-b');
  });

  it('puts the image last, after the argument terminator', () => {
    expect(args[args.length - 2]).toBe('--');
    expect(args[args.length - 1]).toBe(placement().imageRef);
  });
});

describe('appleEngine.listOwned', () => {
  // Apple's inspect shape is not Docker's: `configuration.id`,
  // `configuration.labels`, `status.networks[].network`. Read as Docker's it
  // yields a container with no labels, which reconciliation calls "not ours"
  // and leaves running forever.
  const answer = JSON.stringify([
    {
      configuration: {
        id: 'holistix_svc_uc_1',
        labels: { [LABEL_PROJECT]: 'proj-1', [LABEL_CONTAINER]: 'uc_1' },
        image: { reference: 'ghcr.io/acme/etl@sha256:aaa' },
      },
      status: { state: 'running', networks: [{ network: 'net-a' }] },
    },
    {
      configuration: {
        id: 'someone-elses',
        labels: { [LABEL_PROJECT]: 'proj-2' },
      },
      status: { state: 'running', networks: [] },
    },
  ]);

  it('reads Apple’s own shape and keeps only this project', async () => {
    const exec: TDockerExec = async () => answer;
    const owned = await appleEngine.listOwned(exec, 'proj-1');

    expect(owned).toHaveLength(1);
    expect(owned[0]).toMatchObject({
      id: 'holistix_svc_uc_1',
      user_container_id: 'uc_1',
      state: 'running',
      networks: ['net-a'],
    });
  });

  it('asks for every container, not only the running ones', async () => {
    // A container that exited is not a container that is missing. Treating it
    // as missing is how a pass turns into recreating the same broken thing.
    const calls: string[][] = [];
    const exec: TDockerExec = async (a) => {
      calls.push(a);
      return answer;
    };
    await appleEngine.listOwned(exec, 'proj-1');
    expect(calls[0]).toContain('--all');
  });

  it('answers nothing for an empty list', async () => {
    const exec: TDockerExec = async () => '  \n';
    expect(await appleEngine.listOwned(exec, 'proj-1')).toEqual([]);
  });

  it('throws on an unreadable answer rather than reporting none', async () => {
    // "Nothing here" would make the pass start every container again.
    const exec: TDockerExec = async () => 'Error: service not running';
    await expect(appleEngine.listOwned(exec, 'proj-1')).rejects.toThrow(
      /Could not read the container list/
    );
  });
});

describe('appleEngine.ensureNetwork', () => {
  it('does not create one that is already there', async () => {
    const calls: string[][] = [];
    const exec: TDockerExec = async (a) => {
      calls.push(a);
      return 'NAME       STATE\nnet-a      running\n';
    };
    await appleEngine.ensureNetwork(exec, 'net-a');
    expect(calls.some((c) => c[1] === 'create')).toBe(false);
  });

  it('matches a whole name, not a prefix', async () => {
    const calls: string[][] = [];
    const exec: TDockerExec = async (a) => {
      calls.push(a);
      return 'NAME             STATE\nnet-a-staging    running\n';
    };
    await appleEngine.ensureNetwork(exec, 'net-a');
    expect(calls.some((c) => c[1] === 'create')).toBe(true);
  });
});
