import { CSSProperties, ReactNode } from 'react';

import { ProjectSidebar } from './sidebar';

//

/**
 * A project page, with the rail beside it or over it.
 *
 * Both halves of one decision, kept in one place so they cannot disagree: the
 * shape the rail takes, and whether the page gives up a column for it. A bar
 * with no indent covers the content — that is how the Resources heading came
 * to read "ources", the bar being fixed and out of flow so nothing gives way
 * to it on its own. An indent with no bar leaves an empty 56px stripe.
 *
 * `island` is for a surface that has no column to spare, which is what a
 * canvas is: the rail floats over it. `dashboard` is for a page with content,
 * where the rail owns a column and the page starts after it.
 *
 * `--holistix-island-left` is the whiteboard coupling, and a page using the
 * island is the one place that knows both facts it needs: that a whiteboard is
 * open, and that a whiteboard publishes where its layers panel ends. The rail
 * reads the variable and has never heard of a layers panel — which is what
 * keeps it usable on a surface that has none. Custom properties inherit, so
 * the rail picks this up through the tree despite being fixed-positioned, and
 * it transitions `left` over the same 120ms the panel animates.
 */
export const ProjectPageFrame = ({
  rail,
  active,
  children,
}: {
  rail: 'island' | 'dashboard';
  active: string;
  children: ReactNode;
}) => {
  const placement =
    rail === 'island'
      ? {
          '--holistix-page-indent': '0px',
          '--holistix-island-left': 'var(--holistix-left-rail, 255px)',
        }
      : { '--holistix-page-indent': 'var(--holistix-sidebar-width, 56px)' };

  return (
    <div
      style={
        {
          height: 'calc(100dvh - var(--header-height))',
          overflow: 'hidden',
          boxSizing: 'border-box',
          paddingLeft: 'var(--holistix-page-indent, 0px)',
          ...placement,
        } as CSSProperties
      }
    >
      {children}
      <ProjectSidebar active={active} variant={rail} />
    </div>
  );
};
