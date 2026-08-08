/**
 * @jest-environment node
 */
import { JLsManager } from './jls-manager';
import type { ResourceListener } from '../driver';
import type { TUserContainer } from '@holistix-forge/user-containers';

// `driver.ts` reaches `@jupyterlab/outputarea`, which ships ESM that jest does
// not transform — and the whole point of this test is that it never builds a
// real driver anyway, because `_getDriver` is replaced below. Written after the
// imports because the transform hoists it above them regardless, and the lint
// rule reads source order.
jest.mock('../driver', () => ({ JupyterlabDriver: class {} }));

/**
 * A stand-in for `JupyterlabDriver` that reproduces the one behaviour the
 * manager depends on, and nothing else: it polls while it has at least one
 * resource listener, starting on the first and stopping with the last.
 *
 * That contract is what `watchResources` is written against — the real driver's
 * `subscribeResourceListener` starts the timer only when the set was empty, and
 * `unsubscribeResourceListener` stops it only when the set empties. Building
 * the real driver here would mean a Jupyter services stack and a live
 * container; the disagreement being tested is between the two counts, and it
 * shows up faithfully at this seam.
 */
class FakeDriver {
  listeners = new Set<ResourceListener>();
  polling = false;
  /** Every subscribe ever made, so a re-subscribe is distinguishable. */
  subscribes = 0;
  unsubscribes = 0;

  subscribeResourceListener = (l: ResourceListener) => {
    const wasEmpty = this.listeners.size === 0;
    this.listeners.add(l);
    this.subscribes += 1;
    if (wasEmpty) this.polling = true;
  };

  unsubscribeResourceListener = (l: ResourceListener) => {
    this.listeners.delete(l);
    this.unsubscribes += 1;
    if (this.listeners.size === 0) this.polling = false;
  };

  stopPollingResources = () => {
    // The old release path. Kept so the test can say what it did *not* do:
    // clear the timer while leaving the listener in the set, which is what made
    // the set never empty again.
    this.polling = false;
  };

  getKernels = () => [];
  getTerminals = () => [];
}

const container = (id: string) => ({ user_container_id: id } as TUserContainer);

const build = () => {
  const dispatched: unknown[] = [];
  const manager = new JLsManager(
    (() => ({})) as never,
    { dispatch: (e: unknown) => dispatched.push(e) } as never,
    (async () => 'token') as never
  );

  const drivers = new Map<string, FakeDriver>();
  // The seam: everything above `_getDriver` is what this test is about.
  (
    manager as unknown as { _getDriver: (s: TUserContainer) => unknown }
  )._getDriver = (s: TUserContainer) => {
    let d = drivers.get(s.user_container_id);
    if (!d) {
      d = new FakeDriver();
      drivers.set(s.user_container_id, d);
    }
    const p = Promise.resolve(d);
    (manager as unknown as { _drivers: Map<string, unknown> })._drivers.set(
      s.user_container_id,
      p
    );
    return p;
  };

  return { manager, drivers, dispatched };
};

const settle = () => new Promise((r) => setImmediate(r));

describe('JLsManager.watchResources', () => {
  it('polls while something is watching, and stops when nothing is', async () => {
    const { manager, drivers } = build();

    const release = manager.watchResources(container('c1'));
    await settle();
    expect(drivers.get('c1')?.polling).toBe(true);

    release();
    await settle();
    expect(drivers.get('c1')?.polling).toBe(false);
  });

  it('starts polling again when a card is closed and reopened', async () => {
    // The regression, and the reason the release unsubscribes rather than
    // stopping the timer directly. Clearing the interval left the listener in
    // the driver's set, so the set never emptied and no later subscribe could
    // start it again — and the acquire path went through the *cached* driver
    // promise, which subscribed nothing. A notebook's terminals and kernels
    // stopped updating for the life of the page.
    const { manager, drivers } = build();

    const release = manager.watchResources(container('c1'));
    // Settled before releasing: the driver has to have opened and subscribed,
    // otherwise this exercises the released-while-opening case instead.
    await settle();
    release();
    await settle();
    expect(drivers.get('c1')?.polling).toBe(false);

    manager.watchResources(container('c1'));
    await settle();

    const d = drivers.get('c1');
    expect(d?.polling).toBe(true);
    // The same driver, subscribed a second time — not a new driver.
    expect(drivers.size).toBe(1);
    expect(d?.subscribes).toBe(2);
  });

  it('costs one listener however many things are watching', async () => {
    // Three nodes showing the same notebook are one timer, and the timer goes
    // with the last of them — not the first.
    const { manager, drivers } = build();

    const a = manager.watchResources(container('c1'));
    const b = manager.watchResources(container('c1'));
    const c = manager.watchResources(container('c1'));
    await settle();

    expect(drivers.get('c1')?.listeners.size).toBe(1);

    a();
    b();
    await settle();
    expect(drivers.get('c1')?.polling).toBe(true);

    c();
    await settle();
    expect(drivers.get('c1')?.polling).toBe(false);
  });

  it('ignores a release called twice', async () => {
    // React calls a cleanup once, but a caller that releases twice would
    // otherwise stop a poll another node still needs.
    const { manager, drivers } = build();

    const first = manager.watchResources(container('c1'));
    manager.watchResources(container('c1'));
    await settle();

    first();
    first();
    await settle();

    expect(drivers.get('c1')?.polling).toBe(true);
  });

  it('does not subscribe when the last watcher left while the driver opened', async () => {
    // Subscribing then would poll a container nothing is looking at, with no
    // release left to stop it.
    const { manager, drivers } = build();

    const release = manager.watchResources(container('c1'));
    release(); // before the driver promise resolves
    await settle();

    expect(drivers.get('c1')?.polling).toBe(false);
    expect(drivers.get('c1')?.subscribes).toBe(0);
  });

  it('keeps containers apart', async () => {
    const { manager, drivers } = build();

    const one = manager.watchResources(container('c1'));
    manager.watchResources(container('c2'));
    await settle();

    one();
    await settle();

    expect(drivers.get('c1')?.polling).toBe(false);
    expect(drivers.get('c2')?.polling).toBe(true);
  });

  it('reports resource changes to the project while watched', async () => {
    const { manager, drivers, dispatched } = build();

    manager.watchResources(container('c1'));
    await settle();

    drivers.get('c1')?.listeners.forEach((l) => l([], []));

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'jupyter:resources-changed',
        user_container_id: 'c1',
      })
    );
  });
});
