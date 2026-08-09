/**
 * @jest-environment jsdom
 *
 * The board's mode bar has to stay reachable.
 *
 * It is the board's own chrome, not a layer's, and it has twice been lost
 * behind a layer: once by being rendered only while ReactFlow was the active
 * surface, and once by sitting at a lower z-index than the drawing surface
 * that covers the whole board and takes the pointer.
 *
 * That second one is not cosmetic. Move mode is the only way to select a node
 * on the drawing surface, because a live node keeps the click for itself — so
 * a mode bar behind the surface means nodes that cannot be selected or moved
 * at all.
 */
import { render, fireEvent } from '@testing-library/react';

import { ModeIndicator } from './ModeIndicator';

//

/** The highest `zIndexHint` any layer declares — the drawing surface's. */
const HIGHEST_LAYER_Z = 10;

const viewport = () => ({ absoluteX: 0, absoluteY: 0, zoom: 1 });

const renderBar = (mode: 'default' | 'move-node' = 'default') => {
  const onModeChange = jest.fn();
  const onContextMenu = jest.fn();
  const { getByTestId, getByText } = render(
    <ModeIndicator
      mode={mode}
      onModeChange={onModeChange}
      onContextMenu={onContextMenu}
      getViewport={viewport}
    />
  );
  return {
    bar: getByTestId('mode-indicator'),
    getByText,
    onModeChange,
    onContextMenu,
  };
};

//

describe('ModeIndicator', () => {
  it('sits above every layer', () => {
    const { bar } = renderBar();

    expect(Number(bar.style.zIndex)).toBeGreaterThan(HIGHEST_LAYER_Z);
  });

  it('takes the pointer, being a sibling of the layer that covers the board', () => {
    // The layer wrapper fills the board and is `pointerEvents: auto` while it
    // is active. Being above it in the stack is not enough on its own.
    const { bar } = renderBar();

    expect(bar.style.pointerEvents).toBe('auto');
  });

  it('offers both modes', () => {
    const { getByText } = renderBar();

    expect(getByText('Normal')).toBeTruthy();
    expect(getByText('Move Node')).toBeTruthy();
  });

  it('switches to move mode when asked', () => {
    const { getByText, onModeChange } = renderBar();

    fireEvent.click(getByText('Move Node'));

    expect(onModeChange).toHaveBeenCalledWith('move-node');
  });

  it('shows which mode is on', () => {
    // The bar is the only feedback there is: move mode changes nothing else
    // on screen until you click something.
    const { getByText } = renderBar('move-node');

    expect(getByText('Move Node').style.fontWeight).toBe('bold');
    expect(getByText('Normal').style.fontWeight).toBe('normal');
  });
});
