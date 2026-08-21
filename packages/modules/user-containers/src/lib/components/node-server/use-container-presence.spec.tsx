import { renderHook } from '@testing-library/react';

import { TF_User } from '@holistix-forge/types';

import { TUserContainer } from '../../servers-types';
import { useContainerPresence } from './node-server';

/**
 * The wiring that was missing.
 *
 * `server-card` has drawn a host avatar and a live-user bubble since it was
 * written, and nothing ever handed it either one — so on a real board a
 * container running on somebody's laptop looked exactly like one running
 * nowhere in particular. The card was never the bug; the absence of this hook
 * was.
 *
 * Everything the hook does is a join between two sources that disagree about
 * what a user is — awareness knows connections, the users API knows people —
 * so these are about that join: duplicates, absences, and the one identity
 * that is not a person at all.
 */

// `node-server` pulls the whiteboard and the reducers in at import time, and
// this hook needs neither.
jest.mock('@holistix-forge/whiteboard/frontend', () => ({
  NodeHeader: () => null,
  DisableZoomDragPan: () => null,
  InputsAndOutputs: () => null,
  useNodeContext: () => ({}),
  useNodeHeaderButtons: () => [],
}));

jest.mock('@holistix-forge/reducers/frontend', () => ({
  useDispatcher: () => ({ dispatch: jest.fn() }),
}));

jest.mock('@holistix-forge/module/frontend', () => ({
  useModuleExports: () => ({
    'user-containers': { getRunners: () => new Map() },
  }),
}));

const mockAwarenessUsers = jest.fn();

jest.mock('@holistix-forge/collab/frontend', () => ({
  useLocalSharedData: () => undefined,
  useAwarenessUserList: () => mockAwarenessUsers(),
}));

/**
 * The users API. Only ids that exist answer — an id with no record leaves its
 * query pending, which is the case the hook has to survive rather than draw.
 */
const mockDirectory: Record<string, object> = {
  'u-ada': {
    user_id: 'u-ada',
    username: 'local:ada',
    firstname: 'Ada',
    lastname: 'Lovelace',
    picture: null,
  },
  'u-alan': {
    user_id: 'u-alan',
    username: 'local:alan',
    firstname: 'Alan',
    lastname: 'Turing',
    picture: null,
  },
};

/** What the hook asked the users API for, latest call last. */
const mockAskedFor: string[][] = [];

jest.mock('@holistix-forge/frontend-data', () => ({
  useQueriesUsers: (ids: string[]) => {
    mockAskedFor.push(ids);
    return ids.map((id) =>
      mockDirectory[id]
        ? { status: 'success', data: mockDirectory[id] }
        : { status: 'pending', data: undefined }
    );
  },
}));

//

const containerOn = (runner: object): TUserContainer =>
  ({
    user_container_id: '1',
    container_name: 'c',
    image_id: '1',
    runner,
    created_at: new Date().toISOString(),
    last_watchdog_at: null,
    last_activity: null,
    httpServices: [],
  } as unknown as TUserContainer);

const LOCAL = { id: 'local', user_id: 'u-ada', machine_id: 'm-1' };
const PLATFORM = { id: 'platform', host: 'platform-host-1' };

beforeEach(() => {
  mockAskedFor.length = 0;
  mockAwarenessUsers.mockReturnValue([]);
});

describe('useContainerPresence — whose machine', () => {
  it('should name the owner of the machine a local placement runs on', () => {
    const { result } = renderHook(() =>
      useContainerPresence(containerOn(LOCAL))
    );

    expect(result.current.host?.username).toBe('local:ada');
  });

  it('should find the host even when they are not in the session', () => {
    // The laptop keeps running the container after its owner closes the board.
    mockAwarenessUsers.mockReturnValue([]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(LOCAL))
    );

    expect(result.current.host?.username).toBe('local:ada');
  });

  it('should claim no host for the platform', () => {
    // The platform is owned by nobody. Naming an owner for it invents one.
    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(result.current.host).toBeUndefined();
  });

  it('should claim no host for a placement that names no one', () => {
    // An older runner, or a container that has not been placed yet.
    const { result } = renderHook(() =>
      useContainerPresence(containerOn({ id: 'local' }))
    );

    expect(result.current.host).toBeUndefined();
  });

  it('should survive a card with no container behind it yet', () => {
    const { result } = renderHook(() => useContainerPresence(undefined));

    expect(result.current.host).toBeUndefined();
    expect(result.current.liveUsers).toEqual([]);
  });
});

describe('useContainerPresence — who is here', () => {
  it('should report the people in the project', () => {
    mockAwarenessUsers.mockReturnValue([
      { user_id: 'u-ada', username: 'ada', color: '#f00' },
      { user_id: 'u-alan', username: 'alan', color: '#0f0' },
    ]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(result.current.liveUsers.map((u: TF_User) => u.username)).toEqual([
      'local:ada',
      'local:alan',
    ]);
  });

  it('should count a person once however many tabs they have open', () => {
    // Awareness is keyed by connection, not by person. Two tabs would
    // otherwise stack two avatars of the same face on the card.
    mockAwarenessUsers.mockReturnValue([
      { user_id: 'u-ada', username: 'ada', color: '#f00' },
      { user_id: 'u-ada', username: 'ada', color: '#f00' },
    ]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(result.current.liveUsers).toHaveLength(1);
  });

  it('should keep the colour awareness gave the person', () => {
    // The colour is the one thing awareness knows that the users API does not,
    // and it is what ties an avatar on the card to a cursor on the board.
    mockAwarenessUsers.mockReturnValue([
      { user_id: 'u-ada', username: 'ada', color: '#f00' },
    ]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(result.current.liveUsers[0].color).toBe('#f00');
  });

  it('should never ask the users API about the guest identity', () => {
    // It is the collab config's fallback, not a person: the API has nothing to
    // say about it and would answer every card on screen with a failed query.
    mockAwarenessUsers.mockReturnValue([
      { user_id: '00000000-0000-0000-0000-000000000001', username: 'guest' },
      { user_id: 'u-ada', username: 'ada' },
    ]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(mockAskedFor[mockAskedFor.length - 1]).toEqual(['u-ada']);
    expect(result.current.liveUsers).toHaveLength(1);
  });

  it('should leave out a person whose record has not arrived', () => {
    // A blank avatar in a bubble is a person who is not there.
    mockAwarenessUsers.mockReturnValue([
      { user_id: 'u-ada', username: 'ada' },
      { user_id: 'u-nobody', username: 'nobody' },
    ]);

    const { result } = renderHook(() =>
      useContainerPresence(containerOn(PLATFORM))
    );

    expect(result.current.liveUsers).toHaveLength(1);
  });

  it('should ask for the host once when they are also in the session', () => {
    mockAwarenessUsers.mockReturnValue([
      { user_id: 'u-ada', username: 'ada', color: '#f00' },
    ]);

    renderHook(() => useContainerPresence(containerOn(LOCAL)));

    expect(mockAskedFor[mockAskedFor.length - 1]).toEqual(['u-ada']);
  });
});
