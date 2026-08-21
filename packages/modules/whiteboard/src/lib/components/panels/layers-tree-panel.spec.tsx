/**
 * @jest-environment jsdom
 *
 * The layers panel's wiring.
 *
 * The drawing is `LayerTree`'s and is pinned next door; what is pinned here is
 * the translation between a panel row and the surface behind it, which is
 * where this file's bugs have actually been.
 *
 * Both of them were the same mistake in two directions: a row's id carries its
 * provider — `excalidraw:layer-2` — and the provider's own verbs do not take
 * that prefix. Handed the prefixed id, `activateLayer` matched no provider,
 * the surface was rendered inactive and the whole board disappeared on a
 * click. So the shape of the id at each boundary is the thing worth a test.
 */
import { render, fireEvent, screen } from '@testing-library/react';

import { LayersTreePanel } from './layers-tree-panel';
import { TLayerActions, TLayerTreeCollection } from '../../layer-tree-types';

//

const activateLayer = jest.fn();
const actions: jest.Mocked<Required<TLayerActions>> = {
  addLayer: jest.fn(),
  reorderLayers: jest.fn(),
  selectLayer: jest.fn(),
  focusItem: jest.fn(),
};

const collection: TLayerTreeCollection = {
  layers: [
    {
      layerId: 'excalidraw:layer-2',
      title: 'Layer 2',
      items: [
        {
          id: 'view-1-element-abc',
          type: 'node',
          title: 'Rectangle 1',
          level: 1,
          visible: true,
          expanded: true,
          locked: false,
          layerId: 'excalidraw',
        },
      ],
    },
    { layerId: 'excalidraw:layer-1', title: 'Layer 1', items: [] },
  ],
};

let mockContext: Record<string, unknown>;

jest.mock('../layer-context', () => ({
  useLayerContext: () => mockContext,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwareness: () => ({
    awareness: {
      getUser: () => ({ username: 'someone' }),
      emitSelectionAwareness: jest.fn(),
    },
  }),
  useAwarenessSelections: () => ({}),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockContext = {
    activeLayerId: 'excalidraw',
    activateLayer,
    treeCollection: collection,
    layerActions: { excalidraw: actions },
  };
});

//

describe('LayersTreePanel', () => {
  it('activates a layer by provider, naming the layer in the payload', () => {
    render(<LayersTreePanel viewId="view-1" />);
    fireEvent.click(screen.getByTitle('Layer 2'));

    // The provider, never the row's id — see the file's header.
    expect(activateLayer).toHaveBeenCalledWith('excalidraw', {
      layerId: 'layer-2',
    });
  });

  it('picks up everything on a layer that is clicked', () => {
    render(<LayersTreePanel viewId="view-1" />);
    fireEvent.click(screen.getByTitle('Layer 2'));

    expect(actions.selectLayer).toHaveBeenCalledWith('layer-2');
  });

  it('brings the board to a row that is clicked', () => {
    render(<LayersTreePanel viewId="view-1" />);
    fireEvent.click(screen.getByTitle('Rectangle 1'));

    // The row's own id, unstripped: the surface is what knows how to read it.
    expect(actions.focusItem).toHaveBeenCalledWith('view-1-element-abc');
    expect(actions.selectLayer).not.toHaveBeenCalled();
  });

  it('offers no controls for verbs the provider did not publish', () => {
    mockContext = {
      ...mockContext,
      layerActions: { excalidraw: { addLayer: null } },
    };
    render(<LayersTreePanel viewId="view-1" />);

    expect(screen.queryByLabelText('New layer')).toBeNull();
    fireEvent.click(screen.getByTitle('Rectangle 1'));
    expect(actions.focusItem).not.toHaveBeenCalled();
  });
});
