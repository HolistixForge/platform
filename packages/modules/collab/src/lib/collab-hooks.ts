import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TAwarenessUser,
  TValidSharedData,
  TUserSelection,
} from '@holistix-forge/collab-engine';
import { bindEditor } from '@holistix-forge/collab-engine/frontend';
import { useModuleExports } from '@holistix-forge/module/frontend';

// Import our own context for project_id (no external dependencies!)
import { useCollabProjectId } from './collab-project-context';

// Re-export types from overrider
import type { TValidSharedDataToCopy } from './overrider';
export type { TValidSharedDataToCopy };

/**
 * Type for collab module exports with multi-project support
 * The collab module now exports a getter function instead of direct instances
 */
type TCollabFrontendExports = {
  getCollabForProject: (project_id: string) => {
    collab: any; // Collab instance
    localOverrider: any; // LocalOverrider instance
  };
};

/**
 * useLocalSharedData - Access shared collaboration data
 *
 * This hook provides access to collaborative shared data for the current project.
 * It automatically subscribes to changes and re-renders when observed data changes.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @param observe - Array of shared data keys to observe for changes
 * @param f - Function that extracts data from shared data
 * @returns The result of the extraction function
 *
 * @example
 * ```tsx
 * <CollabProjectProvider project_id="my-project">
 *   <MyComponent />
 * </CollabProjectProvider>
 *
 * function MyComponent() {
 *   const tabs = useLocalSharedData(['tabs:tabs'], (d) =>
 *     d['tabs:tabs'].get('unique')
 *   );
 *   return <div>{tabs.length} tabs</div>;
 * }
 * ```
 */
export const useLocalSharedData = <TSharedData extends TValidSharedData>(
  observe: Array<keyof TSharedData>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  f: (data: any) => any
): ReturnType<typeof f> => {
  const project_id = useCollabProjectId(); // ← Get project_id from collab context
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useLocalSharedData'
  );

  // Get project-specific collab instance
  const { localOverrider } = exports.collab.getCollabForProject(project_id);

  const [, refresh] = useState({});
  const updateComponent = useRef(() => refresh({}));

  // Every call site passes an array literal, so `observe` is a new reference
  // on every render. Depending on it directly re-subscribed once per render,
  // and since `unobserve` detaches the overrider from the shared map as soon
  // as a key has no observer left, each render tore the shared-data
  // subscription down and built it back up. Key it on the contents instead.
  const keysId = (observe as string[]).join('\u0000');
  const keys = useMemo(() => keysId.split('\u0000'), [keysId]);

  // Subscribe to changes. This has to happen during render: the first
  // `observe` of a key is what materializes it in the overrider's local
  // copy, and `f` reads that copy below on this very render.
  useMemo(() => {
    localOverrider.observe(keys, updateComponent.current);
  }, [localOverrider, keys]);

  // Cleanup subscription
  useEffect(() => {
    const update = updateComponent.current;
    return () => {
      localOverrider.unobserve(keys, update);
    };
  }, [localOverrider, keys]);

  return f(localOverrider.getData());
};

/**
 * useLocalSharedDataManager - Get the LocalOverrider manager
 *
 * Provides direct access to the LocalOverrider for advanced use cases.
 * Most code should use useLocalSharedData instead.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns LocalOverrider instance for current project
 */
export const useLocalSharedDataManager = <
  TSharedData extends TValidSharedData
>() => {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useLocalSharedDataManager'
  );

  const { localOverrider } = exports.collab.getCollabForProject(project_id);
  return localOverrider;
};

/**
 * useAwareness - Get awareness instance for current project
 *
 * Awareness tracks user presence, cursors, selections, etc.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns Object with awareness instance
 */
export const useAwareness = () => {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwareness'
  );

  const { collab } = exports.collab.getCollabForProject(project_id);
  return { awareness: collab.awareness };
};

/**
 * useAwarenessUserList - Subscribe to list of active users
 *
 * Returns array of users currently active in the project.
 * Updates when users join/leave or change their info (name, color).
 * Does NOT update on pointer/selection changes (use useAwarenessSelections for that).
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns Array of active users with username and color
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const users = useAwarenessUserList();
 *   return (
 *     <div>
 *       {users.map(u => <UserAvatar key={u.user_id} {...u} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAwarenessUserList(): TAwarenessUser[] {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwarenessUserList'
  );

  const { collab } = exports.collab.getCollabForProject(project_id);
  const awareness = collab.awareness;

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

/**
 * useAwarenessSelections - Subscribe to selection tracking
 *
 * Returns object mapping nodeId to array of users selecting that node.
 * Updates when any user's selection changes.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns Object mapping nodeId -> selecting users
 *
 * @example
 * ```tsx
 * function NodeSelections({ nodeId }: { nodeId: string }) {
 *   const selections = useAwarenessSelections();
 *   const selectingUsers = selections[nodeId] || [];
 *   return <div>{selectingUsers.length} users selecting</div>;
 * }
 * ```
 */
export function useAwarenessSelections(): {
  [nodeId: string]: TUserSelection[];
} {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useAwarenessSelections'
  );

  const { collab } = exports.collab.getCollabForProject(project_id);
  const awareness = collab.awareness;

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

/**
 * useBindEditor - Get editor binding function
 *
 * Returns a function to bind a text editor (Monaco, CodeMirror, etc.)
 * to YJS for collaborative editing.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns Function to bind an editor instance
 *
 * @example
 * ```tsx
 * function CodeEditor() {
 *   const editorRef = useRef(null);
 *   const bindEditorToYjs = useBindEditor();
 *
 *   useEffect(() => {
 *     if (editorRef.current) {
 *       bindEditorToYjs('monaco', 'my-doc-id', editorRef.current);
 *     }
 *   }, [bindEditorToYjs]);
 *
 *   return <div ref={editorRef} />;
 * }
 * ```
 */
export const useBindEditor = () => {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useBindEditor'
  );

  const { collab } = exports.collab.getCollabForProject(project_id);
  const { awareness, sharedEditor } = collab;

  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editorType: string, editorId: string, editorObject: any) => {
      bindEditor(awareness, sharedEditor, editorType, editorId, editorObject);
    },
    [awareness, sharedEditor]
  );
};

/**
 * useSharedDataDirect - Get direct access to shared data
 *
 * Provides raw access to YJS shared data structures.
 * Use useLocalSharedData instead for reactive updates.
 *
 * **Requires**: Component must be wrapped with `<CollabProjectProvider project_id={...}>`
 *
 * @returns Shared data object with all collaborative maps/arrays
 */
export const useSharedDataDirect = <TSharedData extends TValidSharedData>() => {
  const project_id = useCollabProjectId();
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>(
    'useSharedDataDirect'
  );

  const { collab } = exports.collab.getCollabForProject(project_id);
  return collab.sharedData as TSharedData;
};
