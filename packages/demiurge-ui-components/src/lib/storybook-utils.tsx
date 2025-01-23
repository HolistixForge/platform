import { ReactNode, useEffect, useState } from 'react';
import { useAction } from './buttons/useAction';
import { useMakeButton } from './nodes/node-common/node-toolbar';
import { TUseNodeValue } from './demiurge-space-2';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (e as any)[propsAttribute];
  }
  return undefined;
};

//

export const sleep = (s?: number) =>
  new Promise<void>((resolve, reject) => {
    setTimeout(
      () => {
        resolve();
      },
      s ? s * 1000 : 1000
    );
  });

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

export const MockReactFlowNodeWrapper = ({
  children,
  selected,
  isOpened,
}: Pick<TUseNodeValue, 'selected' | 'isOpened'> & {
  children: ReactNode;
}) => {
  return (
    <div
      className={`react-flow__node-wrapper node-${
        isOpened ? 'opened' : 'closed'
      } ${selected ? 'selected' : ''}`}
    >
      {children}
    </div>
  );
};

//

export const useTestToolbarButtons = (_isOpened = false, _isLocked = false) => {
  const [isOpened, setIsOpened] = useState(_isOpened);
  const [isLocked, setIsLocked] = useState(_isLocked);
  const buttons = useMakeButton({
    isExpanded: isOpened,
    expand: () => setIsOpened(true),
    reduce: () => setIsOpened(false),

    isLocked,
    onLock: () => setIsLocked(true),
    onUnlock: () => setIsLocked(false),

    onPlay: () => null,
    onClear: () => null,

    onFullScreen: () => null,

    onDelete: sleep,
  });
  return { buttons };
};

//

export const useNotImplemented = () => {
  const action = useAction(
    () => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Not implemented'));
        }, 1000);
      });
    },
    [],
    { errorLatchTime: 5000 }
  );
  return action;
};
