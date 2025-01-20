import { ReactElement, useRef } from 'react';

const injectCssCoord = (e: HTMLElement, X: number, Y: number) => {
  const rX = -(X - 0.5) * 26;
  const rY = (Y - 0.5) * 26;
  const bgX = 40 + 20 * X;
  const bgY = 40 + 20 * Y;
  e.style.setProperty('--x', 100 * X + '%');
  e.style.setProperty('--y', 100 * Y + '%');
  e.style.setProperty('--bg-x', bgX + '%');
  e.style.setProperty('--bg-y', bgY + '%');
  e.style.setProperty('--r-x', rX + 'deg');
  e.style.setProperty('--r-y', rY + 'deg');
};

//
//
//
//

export const WrapperCssCoordinates = ({
  children,
  clearOnLeave,
}: {
  children?: ReactElement;
  clearOnLeave?: boolean;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMouseMove = (event: React.MouseEvent) => {
    if (ref.current) {
      const w = ref.current.clientWidth;
      const h = ref.current.clientHeight;
      const b = ref.current.getBoundingClientRect();
      const X = (event.clientX - b.left) / w;
      const Y = (event.clientY - b.top) / h;
      injectCssCoord(ref.current, X, Y);
    }
  };

  const onMouseLeave = () => {
    if (ref.current) {
      if (clearOnLeave) {
        ref.current.style.removeProperty('--x');
        ref.current.style.removeProperty('--y');
        ref.current.style.removeProperty('--bg-x');
        ref.current.style.removeProperty('--bg-y');
        ref.current.style.removeProperty('--r-x');
        ref.current.style.removeProperty('--r-y');
      } else injectCssCoord(ref.current, 0.5, 0.5);
    }
  };

  const onMount = (d: HTMLDivElement) => {
    if (d) {
      ref.current = d;
      injectCssCoord(d, 0.5, 0.5);
    }
  };

  //

  return (
    <div
      style={{ width: 'fit-content' }}
      ref={onMount}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};
