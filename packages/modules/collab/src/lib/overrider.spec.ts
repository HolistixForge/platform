import { LocalOverrider } from './overrider';

//

/** Minimal stand-in for a collab SharedMap: copy + observe/unobserve. */
const makeSharedMap = (entries: [string, unknown][] = []) => {
  const data = new Map(entries);
  const observers: (() => void)[] = [];
  return {
    data,
    copy: () => new Map(data),
    observe: (o: () => void) => observers.push(o),
    unobserve: (o: () => void) => {
      const i = observers.indexOf(o);
      if (i !== -1) observers.splice(i, 1);
    },
    observerCount: () => observers.length,
    set(key: string, value: unknown) {
      data.set(key, value);
      observers.slice().forEach((o) => o());
    },
  };
};

const makeOverrider = () => {
  const map = makeSharedMap([['a', { n: 1 }]]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overrider = new LocalOverrider({ 'test:map': map } as any);
  return { map, overrider };
};

//

describe('LocalOverrider', () => {
  it('materializes a key on the first observe without calling observers', () => {
    const { map, overrider } = makeOverrider();
    const observer = jest.fn();

    overrider.observe(['test:map'], observer);

    // The subscriber reads the data itself right after subscribing, so
    // notifying here would re-enter the caller — for React, mid-render.
    expect(observer).not.toHaveBeenCalled();
    expect(overrider.getData()['test:map']).toEqual(map.data);
  });

  it('notifies observers when the shared data changes', () => {
    const { map, overrider } = makeOverrider();
    const observer = jest.fn();

    overrider.observe(['test:map'], observer);
    map.set('b', { n: 2 });

    expect(observer).toHaveBeenCalledTimes(1);
    expect(overrider.getData()['test:map']).toEqual(
      new Map([
        ['a', { n: 1 }],
        ['b', { n: 2 }],
      ])
    );
  });

  it('detaches from the shared data once the last observer leaves', () => {
    const { map, overrider } = makeOverrider();
    const observer = jest.fn();

    overrider.observe(['test:map'], observer);
    expect(map.observerCount()).toBe(1);

    overrider.unobserve(['test:map'], observer);
    expect(map.observerCount()).toBe(0);

    // and re-attaches cleanly, still without notifying
    overrider.observe(['test:map'], observer);
    expect(map.observerCount()).toBe(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it('keeps observing while another observer remains', () => {
    const { map, overrider } = makeOverrider();
    const first = jest.fn();
    const second = jest.fn();

    overrider.observe(['test:map'], first);
    overrider.observe(['test:map'], second);
    overrider.unobserve(['test:map'], first);

    expect(map.observerCount()).toBe(1);

    map.set('b', { n: 2 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
