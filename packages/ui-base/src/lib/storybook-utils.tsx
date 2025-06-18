import { useEffect, useState } from 'react';
import { useAction } from './buttons/useAction';

//

export const playAdd__hover = (toClassName: string) => {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const e = canvasElement.getElementsByClassName(toClassName);
    for (let i = 0; i < e.length; i++) e[i].classList.add('testhover');
  };
};

//

/**
 * retreive a component props from the rendered HTML or SVG element
 */
export const htmlElementToReactProps = (e: HTMLElement | SVGElement) => {
  const attributes = Object.keys(e);
  const propsAttribute = attributes.find((a) => a.includes('__reactProps'));
  if (propsAttribute) {
    return (e as any)[propsAttribute];
  }
  return undefined;
};

//

export const useTestBoolean = (init: boolean) => {
  const [is, set] = useState(init);
  useEffect(() => {
    set(init);
  }, [init]);
  return {
    is,
    set: () => set(true),
    unset: () => set(false),
  };
};

//

export const useNotImplemented = () => {
  const action = useAction(
    () => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Permission denied'));
        }, 1000);
      });
    },
    [],
    { errorLatchTime: 5000 }
  );
  return action;
};
