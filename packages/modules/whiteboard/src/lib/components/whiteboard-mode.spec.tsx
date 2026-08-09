/**
 * @jest-environment jsdom
 *
 * The board's mode, read from wherever a node is drawn.
 *
 * A node rendered inside the Excalidraw scene has to know whether move mode is
 * on: while it is, the node stops taking the pointer so the click reaches the
 * canvas and Excalidraw can select and drag it. That reading happens deep
 * inside another module's render tree, which is why it is a hook and not a
 * prop.
 *
 * The fallback matters as much as the reading. A node drawn in a story or a
 * test has no provider above it, and `default` is the truthful answer there —
 * throwing would only say "you are not on a board", which the caller knows.
 */
import { render } from '@testing-library/react';

import {
  ReactflowLayerContext,
  useWhiteboardMode,
  TWhiteboardContext,
} from './reactflow-layer-context';

//

const Probe = () => <span data-testid="mode">{useWhiteboardMode()}</span>;

const contextWith = (mode: string): TWhiteboardContext =>
  ({
    spaceState: {} as never,
    mode,
    viewId: 'view-1',
    edgeMenu: null,
    setEdgeMenu: () => undefined,
    resetEdgeMenu: () => undefined,
  } as TWhiteboardContext);

const modeUnder = (value?: TWhiteboardContext) => {
  const { getByTestId } = value
    ? render(
        <ReactflowLayerContext value={value}>
          <Probe />
        </ReactflowLayerContext>
      )
    : render(<Probe />);
  return getByTestId('mode').textContent;
};

//

describe('useWhiteboardMode', () => {
  it('reports the mode the board is in', () => {
    expect(modeUnder(contextWith('move-node'))).toBe('move-node');
  });

  it('reports default when the board is in default', () => {
    expect(modeUnder(contextWith('default'))).toBe('default');
  });

  it('reports default with no board above it at all', () => {
    // A node in a story, or in another module's test. Not on a board, so not
    // in move mode.
    expect(modeUnder()).toBe('default');
  });
});
