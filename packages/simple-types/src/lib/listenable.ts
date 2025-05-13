import { useCallback, useEffect, useState } from 'react';

//

type Listener = () => void;

export class Listenable {
  private listeners: Listener[] = [];

  addListener(listener: Listener, ...args: any): void {
    this.listeners.push(listener);
  }

  removeListener(listener: Listener, ...args: any): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  protected notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

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
