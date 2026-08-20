/**
 * Which machines can be placed on.
 *
 * The rule decides whether a person is offered a machine that will never
 * receive their placement, so it is tested against a fixed clock rather than
 * read off a screenshot.
 */

import { TApi_Runner } from '@holistix-forge/types';
import { MACHINE_STALE_AFTER_MS, describeMachines } from './machines-queries';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');

const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const runner = (overrides: Partial<TApi_Runner> = {}): TApi_Runner => ({
  runner_id: 'r1',
  label: 'mac-m1',
  created_at: at(60 * 60 * 1000),
  last_seen_at: at(1000),
  revoked_at: null,
  ...overrides,
});

describe('describeMachines', () => {
  it('offers a machine seen just now', () => {
    expect(describeMachines([runner()], NOW)[0].unavailable).toBeNull();
  });

  it('offers a machine seen just inside the threshold', () => {
    const seen = runner({ last_seen_at: at(MACHINE_STALE_AFTER_MS - 1) });
    expect(describeMachines([seen], NOW)[0].unavailable).toBeNull();
  });

  it('withholds a machine that has gone quiet', () => {
    const quiet = runner({ last_seen_at: at(MACHINE_STALE_AFTER_MS + 1) });
    expect(describeMachines([quiet], NOW)[0].unavailable).toBe('unreachable');
  });

  // Enrolled and never started. What the person has to do about it is the same
  // as for a machine that went quiet, so it is not a third state.
  it('withholds a machine that has never called', () => {
    const fresh = runner({ last_seen_at: null });
    expect(describeMachines([fresh], NOW)[0].unavailable).toBe('unreachable');
  });

  // Listed, and marked — hiding it would make a revocation look like a
  // deletion, and the owner is who needs to tell them apart.
  it('lists a revoked machine and withholds it', () => {
    const gone = runner({ revoked_at: at(5000) });
    const [described] = describeMachines([gone], NOW);
    expect(described.label).toBe('mac-m1');
    expect(described.unavailable).toBe('revoked');
  });

  // A revoked machine can also be recently seen — the revocation is what
  // matters, and it is the more informative of the two.
  it('says revoked rather than unreachable when both apply', () => {
    const gone = runner({
      revoked_at: at(5000),
      last_seen_at: at(MACHINE_STALE_AFTER_MS + 1),
    });
    expect(describeMachines([gone], NOW)[0].unavailable).toBe('revoked');
  });

  it('keeps every machine in the list', () => {
    const list = describeMachines(
      [
        runner({ runner_id: 'a' }),
        runner({ runner_id: 'b', revoked_at: at(1) }),
        runner({ runner_id: 'c', last_seen_at: null }),
      ],
      NOW
    );
    expect(list.map((m) => m.runner_id)).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty list', () => {
    expect(describeMachines([], NOW)).toEqual([]);
  });
});
