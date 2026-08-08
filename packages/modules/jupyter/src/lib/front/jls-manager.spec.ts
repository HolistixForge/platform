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

/**
 * A kernel pack is built during render and the project is set from an effect,
 * so every pack on the first render exists before the manager knows which
 * document to read. `_updateKernelPack` returns early in that state — refusing
 * to claim a server is missing when it cannot yet tell — which leaves the pack
 * at its initial `SERVER_DOES_NOT_EXIST`.
 *
 * Correct until the project arrives, and wrong from then on: nothing recomputed
 * the packs, so a panel stayed greyed out with the service running until some
 * unrelated shared-data change happened to fire.
 */

/** A SharedMap stand-in that records who is observing it. */
const sharedMap = (entries: Record<string, unknown> = {}) => {
  const observers = new Set<() => void>();
  return {
    observers,
    get: (k: string) => entries[k],
    observe: (cb: () => void) => observers.add(cb),
    unobserve: (cb: () => void) => observers.delete(cb),
  };
};

const projectDocs = () => ({
  'user-containers:containers': sharedMap(),
  'jupyter:servers': sharedMap(),
});

const withProjects = () => {
  const docs = new Map<string, ReturnType<typeof projectDocs>>();
  const manager = new JLsManager(
    ((project_id: string) => {
      if (!docs.has(project_id)) docs.set(project_id, projectDocs());
      return docs.get(project_id);
    }) as never,
    { dispatch: async () => undefined } as never,
    (async () => 'token') as never
  );
  return { manager, docs };
};

describe('JLsManager.setProjectId', () => {
  it('recomputes packs that were created before the project was known', () => {
    const { manager } = withProjects();

    // Built during render, while `_sd` is still null — which is when
    // `useKernelPack` actually calls this.
    manager.getKernelPack('uc-1', 'kernel-1');

    const onChange = jest.spyOn(
      manager as unknown as { _onChange: () => void },
      '_onChange' as never
    );

    manager.setProjectId('project-1');

    expect(onChange).toHaveBeenCalled();
    onChange.mockRestore();
  });

  it('lets go of the previous project before observing the next', () => {
    // Every switch used to add an observer and remove none, so a document
    // nobody is looking at kept calling back for the life of the page — each
    // one recomputing every pack against whichever project is current.
    const { manager, docs } = withProjects();

    manager.setProjectId('project-1');
    const first = docs.get('project-1');
    expect(first?.['jupyter:servers'].observers.size).toBe(1);
    expect(first?.['user-containers:containers'].observers.size).toBe(1);

    manager.setProjectId('project-2');

    expect(first?.['jupyter:servers'].observers.size).toBe(0);
    expect(first?.['user-containers:containers'].observers.size).toBe(0);
    expect(docs.get('project-2')?.['jupyter:servers'].observers.size).toBe(1);
  });

  it('does not observe twice for the same project', () => {
    const { manager, docs } = withProjects();

    manager.setProjectId('project-1');
    manager.setProjectId('project-1');

    expect(docs.get('project-1')?.['jupyter:servers'].observers.size).toBe(1);
  });
});
