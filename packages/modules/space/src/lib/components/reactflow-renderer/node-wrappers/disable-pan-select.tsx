import { ReactNode } from 'react';

/**
 * disable React flow mouse event to avoid canvas pan, zoom and node selection
 * on the children content.
 * @param param0
 * @returns
 */
export const DisablePanSelect = ({ children }: { children: ReactNode }) => {
  return (
    <div className="disable-pan-select nodrag nospan nowheel">{children}</div>
  );
};
