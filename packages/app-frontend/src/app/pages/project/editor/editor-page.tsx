import { CSSProperties } from 'react';

import { ProjectSidebar } from '../sidebar';
import { EditorTabsSystemLogic, useActiveTab } from './tabs';

//

export const EditorPage = () => {
  const { payload } = useActiveTab();

  // The whiteboard is a canvas: it has no column to give up, and indenting it
  // would only shrink the board. So the rail floats over it as an island.
  // Every other tab is a page with content, and there the rail is a bar with
  // the content beside it rather than under it.
  const onWhiteboard = payload?.type === 'node-editor';

  // Both halves of one decision, written together so they cannot disagree.
  //
  // A bar with no indent covers the content — that is how the Resources
  // heading came to read "ources", the bar being fixed and out of flow so
  // nothing gives way to it on its own. An indent with no bar leaves an empty
  // stripe. Split across two expressions they drift; here changing one means
  // seeing the other.
  //
  // `--holistix-island-left` is the whiteboard coupling, and this is the one
  // place that knows both facts it needs: that the open tab is a whiteboard,
  // and that a whiteboard publishes where its layers panel ends. The rail
  // component knows neither — it reads the variable and has no idea what a
  // layers panel is, which is what keeps it usable on a surface that has none.
  // It used to read the whiteboard's own variable, and off the whiteboard that
  // is unset, so it fell back to a guess at the panel's width on every page
  // with no panel. Custom properties inherit, so the rail picks this up
  // through the tree despite being fixed-positioned, and it transitions `left`
  // over the same 120ms the panel animates — the two move together when the
  // panel is collapsed or expanded.
  const placement = onWhiteboard
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
      <EditorTabsSystemLogic />
      <ProjectSidebar
        active="project-main"
        variant={onWhiteboard ? 'island' : 'dashboard'}
      />
    </div>
  );
};
