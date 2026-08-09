/**
 * @jest-environment jsdom
 *
 * The board's contents, as a tree.
 *
 * It replaced a flattened list whose nesting was faked with left margins.
 * Flat, a group could not be closed, and "inside that group" looked exactly
 * like "below it, at the same level" — an indent is not a containment when
 * nothing can be collapsed to prove it.
 *
 * The thing worth pinning is therefore the walk: what is drawn, in what
 * order, and what disappears when something is shut. The styling is not
 * asserted here — that is what the stories are for.
 */
import { render, fireEvent } from '@testing-library/react';

import { LayerTree } from './layer-tree';
import { TLayerTreeCollection, TLayerTreeItem } from '../../layer-tree-types';

//

const node = (
  id: string,
  over: Partial<TLayerTreeItem> = {}
): TLayerTreeItem => ({
  id,
  type: 'node',
  title: id,
  level: 1,
  visible: true,
  expanded: true,
  locked: false,
  layerId: 'excalidraw',
  ...over,
});

const collection: TLayerTreeCollection = {
  layers: [
    {
      layerId: 'excalidraw',
      title: 'Excalidraw',
      items: [
        node('alone'),
        {
          ...node('grp'),
          type: 'group',
          children: [node('inside-1'), node('inside-2')],
        },
      ],
    },
    {
      layerId: 'reactflow',
      title: 'Base layer',
      items: [node('other', { layerId: 'reactflow' })],
    },
  ],
};

const draw = (props: Partial<Parameters<typeof LayerTree>[0]> = {}) => {
  const utils = render(
    <LayerTree collection={collection} activeLayerId="excalidraw" {...props} />
  );
  const titles = () =>
    Array.from(utils.container.querySelectorAll('li')).map(
      (li) => li.getAttribute('title') ?? ''
    );
  return { ...utils, titles };
};

//

describe('LayerTree', () => {
  it('draws every layer and what is in it, in order', () => {
    expect(draw().titles()).toEqual([
      'Excalidraw',
      'alone',
      'grp',
      'inside-1',
      'inside-2',
      'Base layer',
      'other',
    ]);
  });

  it('closes a group, and what is inside it goes with it', () => {
    const { titles, getByTitle } = draw();

    fireEvent.click(getByTitle('grp').querySelector('button') as HTMLElement);

    expect(titles()).toEqual([
      'Excalidraw',
      'alone',
      'grp',
      'Base layer',
      'other',
    ]);
  });

  it('closes a whole layer', () => {
    const { titles, getByTitle } = draw();

    fireEvent.click(
      getByTitle('Excalidraw').querySelector('button') as HTMLElement
    );

    expect(titles()).toEqual(['Excalidraw', 'Base layer', 'other']);
  });

  it('does not walk what is closed', () => {
    // Not merely hidden: a board with two thousand nodes should cost nothing
    // to draw while its layer is shut.
    const { container, getByTitle } = draw();

    fireEvent.click(
      getByTitle('Excalidraw').querySelector('button') as HTMLElement
    );

    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('opens everything by default, so a new node arrives visible', () => {
    // The state is "what is shut", not "what is open" — a node created while
    // its layer is open should not appear folded away.
    expect(draw().titles()).toContain('inside-1');
  });

  it('activates a layer when its row is clicked', () => {
    const onActivateLayer = jest.fn();
    const { getByTitle } = draw({ onActivateLayer });

    fireEvent.click(getByTitle('Base layer'));

    expect(onActivateLayer).toHaveBeenCalledWith('reactflow');
  });

  it('selects an item when its row is clicked', () => {
    const onSelect = jest.fn();
    const { getByTitle } = draw({ onSelect });

    fireEvent.click(getByTitle('inside-1'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inside-1' })
    );
  });

  it('does not select the row a twist was clicked on', () => {
    // Opening a group is not choosing it, and the two targets are 14px apart.
    const onSelect = jest.fn();
    const { getByTitle } = draw({ onSelect });

    fireEvent.click(getByTitle('grp').querySelector('button') as HTMLElement);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks what the user has selected on the board', () => {
    const { getByTitle } = draw({ selectedIds: ['inside-2'] });

    expect(getByTitle('inside-2').className).toContain(
      'layer-tree__row--selected'
    );
    expect(getByTitle('alone').className).not.toContain(
      'layer-tree__row--selected'
    );
  });

  it('dims what belongs to another layer, and only dims it', () => {
    // Still legible, still clickable: dimming says "not here", not
    // "not available".
    const { getByTitle } = draw();

    expect(getByTitle('other').className).toContain('layer-tree__row--dimmed');
    expect(getByTitle('alone').className).not.toContain(
      'layer-tree__row--dimmed'
    );
  });

  it('indents by depth, as a variable the row reads', () => {
    // A variable and not a margin, so the row's background still runs the
    // full width — a hover that stops short reads as a chip, not a row.
    const { getByTitle } = draw();

    expect(getByTitle('Excalidraw').style.getPropertyValue('--depth')).toBe(
      '0'
    );
    expect(getByTitle('alone').style.getPropertyValue('--depth')).toBe('1');
    expect(getByTitle('inside-1').style.getPropertyValue('--depth')).toBe('2');
  });

  it('gives a twist only to what has something inside', () => {
    // Hidden rather than absent, so every title starts at the same offset
    // whether or not its row happens to have children.
    const { getByTitle } = draw();

    expect(
      (getByTitle('grp').querySelector('button') as HTMLElement).style
        .visibility
    ).toBe('visible');
    expect(
      (getByTitle('alone').querySelector('button') as HTMLElement).style
        .visibility
    ).toBe('hidden');
  });

  it('draws nothing but the layer for a board nobody has touched', () => {
    const { container } = render(
      <LayerTree
        collection={{
          layers: [{ layerId: 'excalidraw', title: 'Excalidraw', items: [] }],
        }}
        activeLayerId="excalidraw"
      />
    );

    expect(container.querySelectorAll('li')).toHaveLength(1);
  });
});
