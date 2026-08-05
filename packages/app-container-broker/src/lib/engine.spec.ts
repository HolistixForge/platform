/**
 * The engine choice, and the price of it.
 *
 * The broker has never had a default runtime, so that running without microVM
 * isolation cannot be reached by omission. The engine choice is the same
 * decision one level up: Docker and Apple `container` do not grant the same
 * controls, and picking one by looking at which binary is installed would
 * decide that silently. These tests are about the refusals.
 */

import { selectEngine, assertConcessionsAccepted } from './engine';
import { dockerEngine } from './engine-docker';
import { appleEngine } from './engine-apple';
import { TBrokerConfig } from './types';

const registry = { docker: dockerEngine, apple: appleEngine };

const config = (
  engine: string,
  acceptedConcessions: string[] = []
): TBrokerConfig => ({
  engine,
  runtime: 'kata',
  acceptedConcessions,
  hostname: 'platform-host-1',
  token: 'broker-token',
  port: 9443,
  maxLimits: { cpus: 4, memoryMb: 8192, pidsLimit: 2048 },
});

const allAppleConcessions = appleEngine.concessions.map((c) => c.id);

describe('selectEngine', () => {
  it('refuses an engine it does not have, and says which it has', () => {
    expect(() => selectEngine(config('podman'), registry)).toThrow(
      /docker, apple/
    );
  });

  it('returns the Docker engine with nothing to accept', () => {
    // The Linux path gives up none of the controls the design rests on, so an
    // empty acknowledgement is the correct config for it. That empty list is
    // what makes the Apple list mean something.
    expect(dockerEngine.concessions).toHaveLength(0);
    expect(selectEngine(config('docker'), registry)).toBe(dockerEngine);
  });

  it('refuses the Apple engine until every concession is written down', () => {
    expect(() => selectEngine(config('apple'), registry)).toThrow(
      /have not been accepted/
    );
  });

  it('names each unaccepted concession, with what it costs', () => {
    // A refusal that only said "concessions not accepted" would be answered by
    // copying ids out of an error message. The operator has to be able to read
    // what they are agreeing to from the refusal itself.
    let message = '';
    try {
      selectEngine(config('apple'), registry);
    } catch (e) {
      message = String(e);
    }

    for (const concession of appleEngine.concessions) {
      expect(message).toContain(concession.id);
      expect(message).toContain(concession.control);
    }
  });

  it('refuses a partial acknowledgement', () => {
    const partial = allAppleConcessions.slice(0, 2);
    expect(() => selectEngine(config('apple', partial), registry)).toThrow(
      /have not been accepted/
    );
  });

  it('accepts the Apple engine once all of them are named', () => {
    expect(selectEngine(config('apple', allAppleConcessions), registry)).toBe(
      appleEngine
    );
  });

  it('refuses a concession the engine does not make', () => {
    // A config copied from the other engine, or a typo. Either way it names a
    // control the running engine has never heard of, and serving traffic on it
    // would mean the deployment believes something untrue about itself.
    expect(() =>
      selectEngine(config('docker', ['no-new-privileges']), registry)
    ).toThrow(/does not give up/);
  });
});

describe('the concession list itself', () => {
  it('describes what is lost rather than what replaces it', () => {
    // The `pids-cgroup` entry is the reason this shape exists: --ulimit nproc
    // is a substitute of a different nature, and an entry that read "replaced
    // by RLIMIT_NPROC" would let it be mistaken for the same control.
    for (const concession of appleEngine.concessions) {
      expect(concession.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(concession.control.length).toBeGreaterThan(0);
      expect(concession.lost.length).toBeGreaterThan(20);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(allAppleConcessions).size).toBe(allAppleConcessions.length);
  });

  it('covers each control the Apple argv leaves out', () => {
    expect(allAppleConcessions).toEqual(
      expect.arrayContaining([
        'no-new-privileges',
        'pids-cgroup',
        'restart-policy',
        'run-may-pull',
        'no-hot-network-attach',
      ])
    );
  });
});

describe('what each engine says about isolation', () => {
  it('makes Docker depend on the runtime under it', () => {
    // runc shares the host kernel; kata does not. The distinction decides
    // whether /dev/net/tun is passed in from the host.
    expect(dockerEngine.isMicroVm('runc')).toBe(false);
    expect(dockerEngine.isMicroVm('kata')).toBe(true);
  });

  it('makes Apple a microVM whatever the runtime handler is named', () => {
    // There is no shared-kernel mode to fall into: the container is a VM. This
    // is the whole reason the engine exists — it reaches that at level 1, with
    // no nested virtualisation, on hardware where Kata cannot run at all.
    expect(appleEngine.isMicroVm('container-runtime-linux')).toBe(true);
    expect(appleEngine.isMicroVm('anything')).toBe(true);
  });

  it('keeps extra hosts on Docker and refuses them on Apple', () => {
    expect(dockerEngine.supportsExtraHosts).toBe(true);
    expect(appleEngine.supportsExtraHosts).toBe(false);
  });
});

describe('assertConcessionsAccepted', () => {
  it('is satisfied by exactly the declared set, in any order', () => {
    expect(() =>
      assertConcessionsAccepted(appleEngine, [...allAppleConcessions].reverse())
    ).not.toThrow();
  });
});
