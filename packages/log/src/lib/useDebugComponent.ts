import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

//

let DEBUG = false;

//

const listeners: React.Dispatch<React.SetStateAction<any>>[] = [];

//

export const showDebugComponent = (b: boolean) => {
  DEBUG = b;
  listeners.forEach((l) => l({}));
};

//

export const useDebugComponent = () => {
  const [, refresh] = useState({});
  useEffect(() => {
    listeners.push(refresh);
    return () => {
      listeners.splice(
        listeners.findIndex((l) => Object.is(l, refresh)),
        1
      );
    };
  }, []);

  return DEBUG;
};

//
//

export const DebugComponentKeyboardShortcut = ({
  key = 'ctrl+y',
}: {
  key?: string;
}) => {
  useHotkeys(key, () => showDebugComponent(!DEBUG), {}, []);
  return null;
};
