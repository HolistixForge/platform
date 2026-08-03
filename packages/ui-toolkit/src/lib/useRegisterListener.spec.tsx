import { act, render } from '@testing-library/react';
import { Listenable } from '@holistix-forge/simple-types';

import { useRegisterListener } from './useRegisterListener';

//

class TestStore extends Listenable {
  notify() {
    this.notifyListeners();
  }

  listenerCount() {
    // `listeners` is private on Listenable, but the count is exactly what
    // this hook's contract is about: one subscription per mounted component.
    return (this as unknown as { listeners: unknown[] }).listeners.length;
  }
}

//

describe('useRegisterListener', () => {
  it('registers a single listener and keeps it across re-renders', () => {
    const store = new TestStore();
    let renders = 0;

    const Component = () => {
      useRegisterListener(store, 'test-label');
      renders++;
      return <div>renders: {renders}</div>;
    };

    render(<Component />);
    expect(store.listenerCount()).toBe(1);

    act(() => store.notify());
    expect(renders).toBe(2);
    expect(store.listenerCount()).toBe(1);

    act(() => store.notify());
    expect(renders).toBe(3);
    // The regression this guards: the listener list used to grow by one on
    // every render, so each notification fanned out into more work than the
    // last one.
    expect(store.listenerCount()).toBe(1);
  });

  it('removes its listener on unmount', () => {
    const store = new TestStore();

    const Component = () => {
      useRegisterListener(store);
      return null;
    };

    const { unmount } = render(<Component />);
    expect(store.listenerCount()).toBe(1);

    unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('re-subscribes when the observed object changes', () => {
    const first = new TestStore();
    const second = new TestStore();

    const Component = ({ store }: { store: TestStore }) => {
      useRegisterListener(store);
      return null;
    };

    const { rerender } = render(<Component store={first} />);
    expect(first.listenerCount()).toBe(1);

    rerender(<Component store={second} />);
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
  });
});
