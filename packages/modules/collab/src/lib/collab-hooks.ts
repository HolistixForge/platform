import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  TAwarenessUser,
  TValidSharedData,
  TUserSelection,
} from '@monorepo/collab-engine';
import { bindEditor } from '@monorepo/collab-engine/frontend';
import { useModuleExports } from '@monorepo/module/frontend';

import { LocalOverrider, TValidSharedDataToCopy } from './overrider';
import { TCollabFrontendExports } from '../frontend';

//

export const useLocalSharedData = <TSharedData extends TValidSharedData>(
  observe: Array<keyof TSharedData>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  f: (data: TValidSharedDataToCopy<TSharedData>) => any
): ReturnType<typeof f> => {
  //
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useLocalSharedData'
  );

  const [, refresh] = useState({});

  const updateComponent = useRef(() => refresh({}));

  useMemo(() => {
    exports.collab.localOverrider.observe(
      observe as string[],
      updateComponent.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () =>
      exports.collab.localOverrider.unobserve(
        observe as string[],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        updateComponent.current
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return f(
    exports.collab.localOverrider.getData() as TValidSharedDataToCopy<TSharedData>
  );
};

//

export const useLocalSharedDataManager = <
  TSharedData extends TValidSharedData
>() => {
  //
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useLocalSharedDataManager'
  );
  return exports.collab.localOverrider as LocalOverrider<TSharedData>;
};

//

export const useAwareness = () => {
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwareness'
  );
  return { awareness: exports.collab.collab.awareness };
};

//

/**
 * useAwarenessUserList: subscribes to the list of active users (username/color),
 * and only updates when the user list changes (not on pointer/selection changes).
 */
export function useAwarenessUserList(): TAwarenessUser[] {
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwarenessUserList'
  );

  const awareness = exports.collab.collab.awareness;

  const [users, setUsers] = useState<TAwarenessUser[]>(() =>
    awareness.getUserList()
  );
  useEffect(() => {
    const listener = () => setUsers(awareness.getUserList());
    awareness.addUserListListener(listener);
    setUsers(awareness.getUserList());
    return () => {
      awareness.removeUserListListener(listener);
    };
  }, [awareness]);
  return users;
}

//

/**
 * useAwarenessSelections: subscribes to selection tracking changes.
 * Returns an object mapping nodeId to selecting users array.
 */

export function useAwarenessSelections(): {
  [nodeId: string]: TUserSelection[];
} {
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwarenessSelections'
  );

  const awareness = exports.collab.collab.awareness;

  const [selections, setSelections] = useState<{
    [nodeId: string]: TUserSelection[];
  }>(() => awareness.getSelectionTracking());
  useEffect(() => {
    const listener = () => setSelections(awareness.getSelectionTracking());
    awareness.addSelectionListener(listener);
    setSelections(awareness.getSelectionTracking());
    return () => {
      awareness.removeSelectionListener(listener);
    };
  }, [awareness]);
  return selections;
}

//

export const useBindEditor = () => {
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useBindEditor'
  );

  const { awareness, sharedEditor } = exports.collab.collab;

  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editorType: string, editorId: string, editorObject: any) => {
      bindEditor(awareness, sharedEditor, editorType, editorId, editorObject);
    },
    [awareness, sharedEditor]
  );
};

//

export const useSharedDataDirect = <TSharedData extends TValidSharedData>() => {
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useSharedDataDirect'
  );
  return exports.collab.collab.sharedData as TSharedData;
};
