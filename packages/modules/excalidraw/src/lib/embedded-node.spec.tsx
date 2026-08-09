/**
 * @jest-environment jsdom
 *
 * Who gets the click on a node drawn inside the scene.
 *
 * Excalidraw gates every embed behind an "Interact" click: `pointer-events`
 * is off until you click the middle third of the element. On an embedded web
 * page that is sensible — you usually want to move it, not use it. On a
 * Holistix node it is backwards, because a node is the thing you came to use;
 * it put one click between the user and every button on every card.
 *
 * So the gate is lifted for live nodes and the board's move mode takes over
 * the selecting, which is the job it already did on the ReactFlow canvas. The
 * rule is three lines and invisible in the running app until you try to click
 * something, so it is stated here.
 */
import { render } from '@testing-library/react';

import {
  EmbeddedNode,
  EmbeddedNodeMeasure,
  nodePointerEvents,
} from './embedded-node';

//

let mockMode = 'default';

const mockNodes = new Map<string, { id: string; type: string }>();
const mockViews = new Map<string, { nodeViews: { id: string }[] }>();

jest.mock('@holistix-forge/whiteboard/frontend', () => ({
  EmbeddedNodeContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useWhiteboardMode: () => mockMode,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useLocalSharedData: (
    keys: string[],
    select: (sd: Record<string, unknown>) => unknown
  ) =>
    select({
      'core-graph:nodes': mockNodes,
      'whiteboard:graphViews': mockViews,
    }),
}));

jest.mock('@holistix-forge/module/frontend', () => ({
  useModuleExports: () => ({
    whiteboard: {
      uiElements: {
        nodes: {
          shape: () => <div data-testid="shape-body" />,
          'user-container': () => <button type="button">Start</button>,
        },
      },
    },
  }),
}));

//

const NODE_ID = 'node-a';
const VIEW_ID = 'view-1';

const prepare = (type: string, mode = 'default') => {
  mockMode = mode;
  mockNodes.clear();
  mockNodes.set(NODE_ID, { id: NODE_ID, type });
  mockViews.clear();
  mockViews.set(VIEW_ID, {
    nodeViews: [{ id: NODE_ID, status: { rank: 0, maxRank: 1 } } as never],
  });
};

const renderNode = (type: string, mode = 'default') => {
  prepare(type, mode);
  const { getByTestId } = render(
    <EmbeddedNode nodeId={NODE_ID} viewId={VIEW_ID} />
  );
  return getByTestId('embedded-node');
};

//

describe('nodePointerEvents', () => {
  it('makes a live node live straight away, with no Interact click', () => {
    expect(nodePointerEvents('user-container', 'default')).toBe('auto');
  });

  it('hands a live node back to the canvas in move mode', () => {
    // Explicitly `none`, not merely unset: an embed already activated by an
    // earlier click has pointer events enabled on the container above, and an
    // unset child would inherit that and keep swallowing the drag.
    expect(nodePointerEvents('user-container', 'move-node')).toBe('none');
  });

  it('leaves a shape to Excalidraw, in either mode', () => {
    // Unset, so the gate stays: click selects, drag moves, and the shape's own
    // toolbar is still reachable the usual way. A shape has nothing running
    // behind it, so there is nothing to be in the way of.
    expect(nodePointerEvents('shape', 'default')).toBeUndefined();
    expect(nodePointerEvents('shape', 'move-node')).toBeUndefined();
  });

  it('treats a group like a shape', () => {
    // Groups are drawn as frames rather than embeds so they never reach this,
    // but the answer would be the same if they did.
    expect(nodePointerEvents('group', 'default')).toBeUndefined();
  });

  it('treats an unknown type as live', () => {
    // Every node type but the whiteboard's own two comes from a feature
    // module, and those are things rather than drawings. A new one should be
    // usable on the day it is registered.
    expect(nodePointerEvents('jupyter-terminal', 'default')).toBe('auto');
  });
});

describe('EmbeddedNode', () => {
  it('takes the pointer for a live node', () => {
    expect(renderNode('user-container').style.pointerEvents).toBe('auto');
  });

  it('releases it while the board is in move mode', () => {
    expect(renderNode('user-container', 'move-node').style.pointerEvents).toBe(
      'none'
    );
  });

  it('sets nothing at all for a shape', () => {
    expect(renderNode('shape').style.pointerEvents).toBe('');
  });

  it('leaves room between the node and the edge of its box', () => {
    // Excalidraw draws the embeddable's border on that edge, so a node laid
    // out flush against it reads as clipped even when it is not.
    expect(renderNode('user-container').style.padding).toBe('8px');
  });

  it('still renders the node’s own component', () => {
    // The rule is about the pointer, not about what is drawn — a live node in
    // move mode is still fully drawn, just not clickable.
    const wrapper = renderNode('user-container', 'move-node');
    expect(wrapper.textContent).toBe('Start');
  });
});

describe('EmbeddedNode — reporting how big it is', () => {
  /**
   * jsdom lays nothing out, so every element measures zero. The sizes are
   * therefore stubbed on the prototype for the length of the test — which is
   * enough, because what is under test is what gets reported and when, not
   * the browser's arithmetic.
   */
  const withContentSize = (width: number, height: number, body: () => void) => {
    const w = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
    const h = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollHeight'
    );
    Object.defineProperty(Element.prototype, 'scrollWidth', {
      configurable: true,
      get: () => width,
    });
    Object.defineProperty(Element.prototype, 'scrollHeight', {
      configurable: true,
      get: () => height,
    });
    try {
      body();
    } finally {
      if (w) Object.defineProperty(Element.prototype, 'scrollWidth', w);
      if (h) Object.defineProperty(Element.prototype, 'scrollHeight', h);
    }
  };

  const reportsFor = (type: string, width: number, height: number) => {
    const reported: { id: string; size: { width: number; height: number } }[] =
      [];
    prepare(type);
    withContentSize(width, height, () => {
      render(
        <EmbeddedNodeMeasure value={(id, size) => reported.push({ id, size })}>
          <EmbeddedNode nodeId={NODE_ID} viewId={VIEW_ID} />
        </EmbeddedNodeMeasure>
      );
    });
    return reported;
  };

  it('reports the size the node wanted, not the size of the box', () => {
    // `scrollWidth`, because the box clips: its own rect only ever says how
    // big the box is, which is the number that was wrong to begin with.
    expect(reportsFor('user-container', 400, 260)).toEqual([
      { id: 'node-a', size: { width: 400, height: 260 } },
    ]);
  });

  it('says nothing before it has been laid out', () => {
    // Zero is not a measurement. Reported, it would shrink the box to nothing
    // and take the node off screen with it.
    expect(reportsFor('user-container', 0, 0)).toEqual([]);
  });

  it('does not need a listener to render', () => {
    // Rendered in a story, or by anything that does not project — there is no
    // one to tell, and that is not an error.
    expect(renderNode('user-container')).toBeTruthy();
  });
});
