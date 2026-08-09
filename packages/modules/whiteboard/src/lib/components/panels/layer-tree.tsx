import { FC, useState, useMemo } from 'react';

import { TLayerTreeCollection, TLayerTreeItem } from '../../layer-tree-types';

import './layer-tree.scss';

//

/**
 * The board's contents, as a tree.
 *
 * Presentational on purpose: it takes the collection and hands back clicks,
 * and knows nothing about awareness, layers or the graph. That is what lets
 * it have stories — the thing it draws is a shape, and a shape can be typed
 * out by hand.
 *
 * It replaced a flattened list whose nesting was faked with left margins.
 * Flat, a group could not be collapsed and there was no way to tell "inside
 * that group" from "below it, at the same level" — the two look identical
 * when the only cue is an indent. Now the tree is a tree, and closing a group
 * closes what is in it.
 *
 * What it does not draw: an eye and a padlock you could click. The board's
 * `onTreeOperation` is a stub that logs, so those would be controls that lie
 * — a thing this board has had enough of. The state is *shown* where it is
 * true, since it can be, and the controls arrive when the operations do.
 */

const GLYPH: Record<TLayerTreeItem['type'], string> = {
  layer: '▤',
  group: '▣',
  node: '◆',
};

type TRow = {
  item: TLayerTreeItem;
  depth: number;
  /** The layer this row belongs to, which decides whether it is dimmed. */
  layerId: string;
};

/**
 * The rows to draw, in order, given what is open.
 *
 * A closed item's children are not walked at all rather than walked and
 * hidden: a board with two thousand nodes should cost nothing to draw while
 * its layer is shut.
 */
const rowsOf = (
  collection: TLayerTreeCollection,
  closed: Set<string>
): TRow[] => {
  const rows: TRow[] = [];

  const walk = (items: TLayerTreeItem[], depth: number, layerId: string) => {
    for (const item of items) {
      rows.push({ item, depth, layerId });
      if (item.children?.length && !closed.has(item.id))
        walk(item.children, depth + 1, layerId);
    }
  };

  for (const layer of collection.layers) {
    rows.push({
      item: {
        id: layer.layerId,
        type: 'layer',
        title: layer.title,
        level: 0,
        visible: true,
        expanded: true,
        locked: false,
        children: layer.items,
        layerId: layer.layerId,
      },
      depth: 0,
      layerId: layer.layerId,
    });
    if (!closed.has(layer.layerId)) walk(layer.items, 1, layer.layerId);
  }

  return rows;
};

//

export const LayerTree: FC<{
  collection: TLayerTreeCollection;
  activeLayerId?: string | null;
  /** Ids the current user has selected on the board. */
  selectedIds?: string[];
  onSelect?: (item: TLayerTreeItem) => void;
  onActivateLayer?: (layerId: string) => void;
}> = ({
  collection,
  activeLayerId,
  selectedIds = [],
  onSelect,
  onActivateLayer,
}) => {
  /**
   * What is shut, rather than what is open.
   *
   * Everything is open by default, and the set only grows when someone closes
   * something — so a node that appears while its layer is open appears open,
   * which is what anyone would expect of a thing that was just created.
   */
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => rowsOf(collection, closed), [collection, closed]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <ul className="layer-tree" role="tree">
      {rows.map(({ item, depth, layerId }) => {
        const isLayer = item.type === 'layer';
        const hasChildren = !!item.children?.length;
        const isOpen = hasChildren && !closed.has(item.id);
        const dimmed = !!activeLayerId && layerId !== activeLayerId;

        return (
          <li
            key={`${layerId}:${item.id}`}
            role="treeitem"
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-selected={selected.has(item.id) || undefined}
            title={item.title}
            data-type={item.type}
            className={[
              'layer-tree__row',
              isLayer ? 'layer-tree__row--layer' : '',
              isLayer && item.id === activeLayerId
                ? 'layer-tree__row--active'
                : '',
              selected.has(item.id) ? 'layer-tree__row--selected' : '',
              dimmed ? 'layer-tree__row--dimmed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            // The indent is a variable rather than a padding so the row's
            // background still runs the full width of the panel, which is
            // what makes a hover read as a row and not as a floating chip.
            style={{ ['--depth' as string]: depth }}
            onClick={() =>
              isLayer ? onActivateLayer?.(item.id) : onSelect?.(item)
            }
          >
            <button
              type="button"
              className="layer-tree__twist"
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              // Invisible rather than absent when there is nothing to open:
              // the titles below would otherwise sit at two different offsets
              // depending on whether a row happens to have children.
              style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
              onClick={(e) => {
                e.stopPropagation();
                toggle(item.id);
              }}
            >
              {isOpen ? '▾' : '▸'}
            </button>

            <span className="layer-tree__glyph" aria-hidden="true">
              {GLYPH[item.type]}
            </span>

            <span className="layer-tree__title">{item.title}</span>

            {item.locked && (
              <span className="layer-tree__flag" title="Locked">
                ⌧
              </span>
            )}
            {!item.visible && !isLayer && (
              <span className="layer-tree__flag" title="Hidden">
                ⌀
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
