/**
 * Opening a running service as a tab.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * This is the one invariant that leaves the whiteboard entirely: a container
 * node on the canvas is also a door into the tab system, and clicking a
 * service on the card is what opens it. The tab is addressed by the payload —
 * which container, which service — and the tab system resolves that into a
 * live view; a payload that loses a field opens a tab onto nothing.
 *
 * The card is not rendered here. The hook is, because the hook is where the
 * event is built and the event is what has to survive a change of surface.
 */
import { renderHook } from '@testing-library/react';

import { useContainerProps } from './node-server';

//

const mockDispatch = jest.fn();
const mockContainers = new Map<string, unknown>();
const mockImages = new Map<string, unknown>();

jest.mock('@holistix-forge/reducers/frontend', () => ({
  useDispatcher: () => ({ dispatch: mockDispatch }),
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useLocalSharedData: (
    keys: string[],
    select: (sd: Record<string, unknown>) => unknown
  ) =>
    select({
      'user-containers:containers': mockContainers,
      'user-containers:images': mockImages,
    }),
}));

//

const CONTAINER_ID = 'uc_abc12345';

const container = (httpServices: { name: string }[]) => ({
  user_container_id: CONTAINER_ID,
  container_name: 'My_Notebook',
  image_id: 'img-1',
  httpServices,
});

const propsFor = (httpServices: { name: string }[]) => {
  mockContainers.clear();
  mockContainers.set(CONTAINER_ID, container(httpServices));
  return renderHook(() => useContainerProps(CONTAINER_ID)).result.current;
};

//

describe('opening a service in a tab', () => {
  beforeEach(() => mockDispatch.mockClear());

  it('asks the tab system for a tab, by container and service name', async () => {
    const props = propsFor([{ name: 'lab' }]);

    await props?.onOpenService('lab');

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tabs:add-tab',
      path: [],
      title: 'My_Notebook:lab',
      payload: {
        type: 'resource-ui',
        user_container_id: CONTAINER_ID,
        service_name: 'lab',
      },
    });
  });

  it('names the tab after the container and the service, so two of them differ', async () => {
    const props = propsFor([{ name: 'lab' }, { name: 'terminal' }]);

    await props?.onOpenService('lab');
    await props?.onOpenService('terminal');

    expect(mockDispatch.mock.calls.map((c) => c[0].title)).toEqual([
      'My_Notebook:lab',
      'My_Notebook:terminal',
    ]);
  });

  it('opens nothing for a service the container does not expose', async () => {
    // Silent rather than throwing, on purpose: the card draws its links from
    // the same list, so this is unreachable from the UI and only happens when
    // the container's services changed under a stale render.
    const props = propsFor([{ name: 'lab' }]);

    await props?.onOpenService('does-not-exist');

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('gives no callbacks at all for a container that is not in shared data', () => {
    mockContainers.clear();

    expect(
      renderHook(() => useContainerProps('uc_missing')).result.current
    ).toBeUndefined();
  });
});
