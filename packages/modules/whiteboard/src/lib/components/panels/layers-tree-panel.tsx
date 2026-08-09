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
  const { activeLayerId, activateLayer, treeCollection, layerActions } =
    useLayerContext();

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

  /**
   * The one provider that owns a stack, today.
   *
   * Its verbs arrive with its layers rather than being reached for, so this
   * panel never learns a provider's vocabulary — it only asks whether anyone
   * offered a way to add, and shows the control if so. No offer, no control:
   * a `+` that does nothing is worse than no `+`.
   */
  const stacked = Object.entries(layerActions ?? {}).find(
    ([, actions]) => actions?.addLayer || actions?.reorderLayers
  );
  const [providerId, actions] = stacked ?? [];

  /** The panel's ids carry their provider; the provider's verbs do not. */
  const bare = (id: string) =>
    providerId && id.startsWith(`${providerId}:`)
      ? id.slice(providerId.length + 1)
      : id;

  return (
    <div style={{ padding: 'var(--spacing-5)' }}>
      <div className="layer-tree-head">
        <h3 className="layer-tree-head__title">Layers</h3>
        {actions?.addLayer && (
          <button
            type="button"
            className="layer-tree-head__add"
            title="New layer"
            aria-label="New layer"
            onClick={() => actions.addLayer?.()}
          >
            +
          </button>
        )}
      </div>

      <LayerTree
        collection={treeCollection}
        activeLayerId={activeLayerId}
        selectedIds={selectedIds}
        // The provider, not the row.
        //
        // A row's id carries its provider — `excalidraw:layer-2` — and the
        // board picks which layer renders by comparing the active id to a
        // *provider* id. Handed the row's, nothing matched, the surface got
        // `active={false}` and unmounted: clicking a layer in the panel made
        // the whole board vanish. Which layer was clicked belongs in the
        // payload, where the surface already looks for it.
        onActivateLayer={(id) =>
          providerId && id.startsWith(`${providerId}:`)
            ? activateLayer(providerId, { layerId: bare(id) })
            : activateLayer(id)
        }
        onSelect={(item) =>
          awareness.emitSelectionAwareness({ nodes: [item.id], viewId })
        }
        onReorderLayers={
          actions?.reorderLayers
            ? (frontToBack) =>
                // Flipped here, where both facts are known: the panel shows
                // the stack front-first and the scene is painted back-first.
                actions.reorderLayers?.([...frontToBack].reverse().map(bare))
            : undefined
        }
      />
    </div>
  );
};
