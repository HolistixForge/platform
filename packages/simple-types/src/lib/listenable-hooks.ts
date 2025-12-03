import { useCallback, useEffect, useState } from 'react';
import { Listenable } from './listenable-core';

//

export const useRegisterListener = (o: Listenable, ...args: any) => {
  const [, _forceUpdate] = useState({});
  const forceUpdate = useCallback(() => {
    // console.log('XXXXXXXXXXXXXXXXXXXXX useRegisterListener Update', ...args);
    _forceUpdate({});
  }, []);
  useEffect(() => {
    o.addListener(forceUpdate);
    return () => o.removeListener(forceUpdate);
  }, [o, forceUpdate]);
};

