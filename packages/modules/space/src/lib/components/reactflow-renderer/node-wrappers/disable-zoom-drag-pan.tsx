import { ReactNode } from 'react';

/**
 * disable React flow mouse event to avoid canvas pan, zoom and node selection
 * on the children content.
 * @param param0
 * @returns
 */
export const DisableZoomDragPan = ({
  children,
  fullHeight,
  noZoom,
  noDrag,
  nopan,
}: {
  children: ReactNode;
  fullHeight?: boolean;
  noZoom?: boolean;
  noDrag?: boolean;
  nopan?: boolean;
}) => {
  const classNames = [
    'disable-zoom-drag-pan',
    fullHeight ? 'full-height-wo-header' : '',
    noZoom ? 'nowheel' : '',
    noDrag ? 'nodrag' : '',
    nopan ? 'nopan' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classNames}>{children}</div>;
};
