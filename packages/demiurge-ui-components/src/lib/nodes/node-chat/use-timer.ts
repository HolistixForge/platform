import { DependencyList, useCallback, useEffect, useMemo, useRef } from 'react';

//

export function useTimer(callback: () => void, deps: DependencyList) {
  //

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cb = useCallback(callback, [...deps]);

  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const v = useMemo(() => {
    //
    const stop = () => {
      // console.log(`stop: ${ref.current ? 'clear timer' : 'nothing to do'}`);
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    };

    const rearm = (timeout: number) => {
      // console.log(`stop before rearm`);
      stop();
      // console.log(`rearm: ${timeout}`);
      ref.current = setTimeout(() => {
        // console.log('trigged');
        ref.current = null;
        cb();
      }, timeout);
      // console.log('rearm done');
    };

    const trigAndStop = () => {
      // console.log('trigAndStop');
      stop();
      cb();
    };

    const isRunning = () => {
      const r = ref.current !== null;
      // console.log(`isRunning: ${r}`);
      return r;
    };

    return {
      stop,
      rearm,
      trigAndStop,
      isRunning,
    };
  }, [cb]);

  useEffect(() => {
    return () => {
      // console.log('useEffect unmount stop');
      v.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return v;
}
