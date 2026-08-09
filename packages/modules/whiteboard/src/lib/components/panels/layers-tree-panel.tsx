import { FC, useMemo } from 'react';

import {
  useAwareness,
  useAwarenessSelections,
} from '@holistix-forge/collab/frontend';

import { useLayerContext } from '../layer-context';
import { LayerTree } from './layer-tree';

//

/**
 * The layers panel: wiring, and nothing else.
 *
 * Everything it used to do itself — flattening the tree, deciding a colour
 * per row, working out which layer an item belonged to — is either gone or in
 * `LayerTree`, which takes a collection and hands back clicks. Splitting them
 * is what makes the drawing storyable: a shape can be typed out by hand,
 * where a component that reaches for awareness and the layer registry cannot.
 *
 * One behaviour changed rather than moved. Only the ReactFlow layer used to
 * be clickable, and only its nodes selectable — written when it was the only
 * surface. It is not, and Excalidraw is the default one, so the panel spent
 * most of its time listing things nobody could touch.
 */
export const LayersTreePanel: FC<{ viewId: string }> = ({ viewId }) => {
  const { activeLayerId, activateLayer, treeCollection } = useLayerContext();

  const { awareness } = useAwareness();
  const selections = useAwarenessSelections();

  /**
   * What this user has selected, in this view.
   *
   * Theirs alone: the panel says where *you* are. Everyone else's selections
   * are already on the board, drawn around the thing itself, and repeating
   * them here would make a busy board's panel unreadable.
   */
  const selectedIds = useMemo(() => {
    const me = awareness.getUser()?.username;
    if (!me) return [];
    return Object.keys(selections).filter((id) =>
      (selections[id] ?? []).some(
        (u) => u.user.username === me && u.viewId === viewId
      )
    );
  }, [selections, awareness, viewId]);

  if (!treeCollection) return null;

  return (
    <div style={{ padding: 'var(--spacing-5)' }}>
      <h3
        style={{
          margin: '0 0 var(--spacing-4)',
          fontSize: 'var(--font-size-sm)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-faint)',
        }}
      >
        Layers
      </h3>

      <LayerTree
        collection={treeCollection}
        activeLayerId={activeLayerId}
        selectedIds={selectedIds}
        onActivateLayer={activateLayer}
        onSelect={(item) =>
          awareness.emitSelectionAwareness({ nodes: [item.id], viewId })
        }
      />
    </div>
  );
};
