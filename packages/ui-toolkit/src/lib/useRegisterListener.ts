import { useCallback, useEffect, useState } from 'react';
import { Listenable } from '@holistix/shared-types';

//

export const useRegisterListener = (o: Listenable, ...args: any) => {
  const [, _forceUpdate] = useState({});
  const forceUpdate = useCallback(() => {
    // console.log('XXXXXXXXXXXXXXXXXXXXX useRegisterListener Update', ...args);
    _forceUpdate({});
  }, []);
  useEffect(() => {
    o.addListener(() => forceUpdate(), ...args);
    return () => o.removeListener?.(forceUpdate, ...args);
  });
  return forceUpdate;
};
