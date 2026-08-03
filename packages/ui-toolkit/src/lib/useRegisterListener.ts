import { useCallback, useEffect, useState } from 'react';
import { Listenable } from '@holistix-forge/simple-types';

//

/**
 * Re-render the calling component whenever `o` notifies its listeners.
 *
 * Subscribe with the very function we unsubscribe with: `Listenable`
 * removes listeners by identity, so registering an anonymous wrapper and
 * unregistering `forceUpdate` never matched and every listener stayed in
 * the list forever. With no dependency array on top of that, the effect
 * re-ran on every render, so the component accumulated one dead listener
 * per render and every notification then did work proportional to how long
 * the component had been alive.
 *
 * The extra `args` are debug labels only — `addListener` ignores them —
 * so they are deliberately not part of the dependency list.
 */

export const useRegisterListener = (o: Listenable, ...args: any) => {
  const [, _forceUpdate] = useState({});
  const forceUpdate = useCallback(() => {
    _forceUpdate({});
  }, []);
  useEffect(() => {
    o.addListener(forceUpdate, ...args);
    return () => o.removeListener?.(forceUpdate, ...args);
    // `args` is a rest parameter, so it is a new array on every render and
    // must stay out of this list — see the note above.
  }, [o, forceUpdate]);
  return forceUpdate;
};
