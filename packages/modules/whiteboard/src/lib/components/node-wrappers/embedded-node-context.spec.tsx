/**
 * @jest-environment jsdom
 *
 * The context a node gets when it is rendered inside the drawing surface.
 *
 * Its value has to keep the same identity between renders. A fresh object each
 * time re-renders every consumer on every render of the provider, and the
 * things rendered through it are the live nodes — a service card that polls, a
 * terminal, a notebook. Built inline, it locked the browser tab up the moment
 * a node first rendered inside the Excalidraw scene, which is a failure that
 * costs a page reload to even observe. Hence a test.
 */
import { useState } from 'react';
import { render, act } from '@testing-library/react';

import { EmbeddedNodeContext, useNodeContext } from './node-wrapper';
import { TNodeContext } from '../apis/types/node';
import { TNodeViewStatus } from '../../whiteboard-types';
import { useStore } from '@xyflow/react';

//

const mockDispatch = jest.fn();
const mockDispatcher = { dispatch: mockDispatch };
const mockAwareness = { awareness: { getUser: () => undefined } };
/** No selection for any node — the case that used to hand out a new array. */
const mockSelections: Record<string, unknown[]> = {};

jest.mock('@holistix-forge/reducers/frontend', () => ({
  useDispatcher: () => mockDispatcher,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwareness: () => mockAwareness,
  useAwarenessSelections: () => mockSelections,
}));

jest.mock('@holistix-forge/ui-toolkit/frontend', () => ({
  useDebugComponent: () => false,
}));

//

const status: TNodeViewStatus = {
  mode: 'EXPANDED',
  forceClosed: false,
  forceOpened: false,
  rank: 0,
  maxRank: 0,
  isFiltered: false,
};

/** Records the context object it is handed, once per render. */
const seen: TNodeContext[] = [];
const Probe = () => {
  seen.push(useNodeContext());
  return null;
};

let forceParentRender: (() => void) | null = null;

const Host = () => {
  const [, setTick] = useState(0);
  forceParentRender = () => setTick((t) => t + 1);
  return (
    <EmbeddedNodeContext id="node-a" viewId="view-1" zoom={1} status={status}>
      <Probe />
    </EmbeddedNodeContext>
  );
};

//

describe('EmbeddedNodeContext', () => {
  beforeEach(() => {
    seen.length = 0;
    forceParentRender = null;
  });

  it('hands out the same context object when nothing about the node changed', () => {
    render(<Host />);
    expect(seen).toHaveLength(1);

    act(() => forceParentRender?.());
    act(() => forceParentRender?.());

    // Re-rendered, so the probe ran again — but on the same value.
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('carries the node and its view', () => {
    render(<Host />);
    expect(seen[0].zoom).toBe(1);
    expect(seen[0].id).toBe('node-a');
    expect(seen[0].viewId).toBe('view-1');
    // `rank < maxRank` is what "opened" means, and this status has 0 < 0.
    expect(seen[0].isOpened).toBe(false);
  });

  it('lets a node reach ReactFlow\u2019s store, which its components do', () => {
    // The node components ask ReactFlow for the zoom and for their connectors.
    // Outside the canvas there is no store, and each one threw "you have not
    // used zustand provider as an ancestor" — a hundred of them blanked the
    // board. Nothing here is asserted about the value; that it does not throw
    // is the point.
    const Zoom = () => {
      const zoom = useStore((s) => s.transform[2]);
      return <span data-testid="zoom">{zoom}</span>;
    };

    expect(() =>
      render(
        <EmbeddedNodeContext
          id="node-a"
          viewId="view-1"
          zoom={1}
          status={status}
        >
          <Zoom />
        </EmbeddedNodeContext>
      )
    ).not.toThrow();
  });

  it('dispatches against the node it was given', () => {
    render(<Host />);
    seen[0].close();
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'whiteboard:close-node',
      nid: 'node-a',
      viewId: 'view-1',
    });
  });
});
