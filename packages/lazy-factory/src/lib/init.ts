import { insertScriptsSynchronously } from '@monorepo/ui-toolkit';
import { useState } from 'react';
import { TLibrary } from './types';

//
//

export const initLibrary = (l: TLibrary) => {
  const proms = new Array<Promise<unknown>>();
  l.components.forEach((c) => {
    if (c.scripts) {
      proms.push(insertScriptsSynchronously(c.scripts));
    }
  });

  l._initp = Promise.all(proms).then(() => {
    return l;
  });

  return l._initp;
};

//
//

export const useIsLibReady = (l: TLibrary) => {
  const [ready, setReady] = useState(false);
  if (!l._initp) initLibrary(l);
  if (!ready) l._initp && l._initp.then(() => setReady(true));
  return { ready };
};
