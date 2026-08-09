import { useMemo, FC, useEffect, useRef, useState, useCallback } from 'react';
import { debounce } from 'lodash';

import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState, Collaborator, SocketId } from '@excalidraw/excalidraw/types';

import { TJsonObject } from '@holistix-forge/simple-types';
import {
  TCoreEvent,
  TCoreSharedData,
  TEdge,
  TGraphNode,
} from '@holistix-forge/core-graph';
import {
  LayerViewportAdapter,
  TLayerProvider,
} from '@holistix-forge/whiteboard/frontend';
import {
  useAwareness,
  useAwarenessUserList,
  useLocalSharedData,
  useSharedDataDirect,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  TNodeView,
  TWhiteboardEvent,
  TWhiteboardSharedData,
} from '@holistix-forge/whiteboard';
import {
  useLayerContext,
  TLayerTreeItem,
} from '@holistix-forge/whiteboard/frontend';

import {
  TExcalidrawSharedData,
  TExcalidrawLayer,
  elementLayerId,
} from './excalidraw-shared-model';
import { TExcalidrawEvent } from './excalidraw-events';
import {
  readDrawingElements,
  sceneSignature,
  versionsById,
} from './excalidraw-scene';
import {
  EmbeddedNode,
  EmbeddedNodeMeasure,
  EMBED_MARGIN,
} from './embedded-node';

//

/**
 * What the layer sends.
 *
 * It writes its own elements, moves the nodes it projects, and — since the
 * surface is where nodes are drawn now — creates and deletes them, which is
 * core-graph's vocabulary rather than the whiteboard's.
 */
type TLayerEvent = TWhiteboardEvent | TExcalidrawEvent | TCoreEvent;

type ExcalidrawAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene: (scene: any) => void;
  getAppState: () => AppState;
  getSceneElementsIncludingDeleted?: () => readonly OrderedExcalidrawElement[];
};

//

let cssLoaded = false;

const ensureCss = async () => {
  if (cssLoaded) return;
  await import('@excalidraw/excalidraw/index.css');
  cssLoaded = true;
};

//

/**
 * The parts of Excalidraw's state this layer owns, and keeps owning.
 *
 * Re-applied over the live state whenever the collaborator list changes, so
 * everything here is an invariant of the surface rather than a preference:
 * the canvas is transparent because the board shows through it, and view mode
 * is off because this is the board itself and not a preview of it.
 *
 * Nothing the user can change belongs here — it would be reset under them the
 * next time someone joined.
 */
export const ownedAppState = {
  viewModeEnabled: false,
  zenModeEnabled: false,
  gridSize: undefined as number | undefined,
  theme: 'light' as const,
  viewBackgroundColor: 'transparent',
};

/**
 * What a new element is drawn with, before anyone picks anything.
 *
 * Excalidraw's default stroke is `#1e1e1e`, a near-black meant for its own
 * white canvas. Ours is transparent over a dark board, so the first stroke a
 * user drew was invisible — not faint, invisible — and the natural reading is
 * that the drawing tool is broken.
 *
 * Applied through `initialData` only, deliberately: it is a starting point,
 * not an invariant. Put in `ownedAppState` above it would be pushed back over
 * the user's own colour every time a collaborator joined or left.
 *
 * Excalidraw's five swatches are still its own, and white is not among them —
 * a user who moves off white comes back through the custom colour field.
 * `topPicks` is not a prop in 0.18.0, so that row cannot be replaced from
 * here.
 */
const itemDefaults = {
  currentItemStrokeColor: '#ffffff',
};

/** What the panel calls this layer. See the provider at the bottom. */
const LAYER_TITLE = 'Layer 1';

//

// There used to be a `fitNodeToDrawing` here, keeping an ExcalidrawNode's box
// on the drawing it stood for. The node is gone: the layer is the whiteboard,
// so a drawing no longer needs anything in the graph to represent it.

/**
 * The link every projected node carries.
 *
 * Excalidraw never calls `renderEmbeddable` for an embeddable whose `link` is
 * null, and `validateEmbeddable` does not rescue one — measured on the
 * installed version. The link also has to be there when the element is
 * created: setting it afterwards does not re-validate, and the element stays
 * blank. So a node gets a sentinel URL that resolves to nothing and is never
 * followed, and what actually identifies it travels in `customData`.
 */
const NODE_LINK_PREFIX = 'https://node.holistix.invalid/';

const nodeLink = (nodeId: string) => `${NODE_LINK_PREFIX}${nodeId}`;

/**
 * Only that host, and nothing else, is embeddable.
 *
 * The scheme is not decoration: a custom one (`holistix:node/…`) produced an
 * element Excalidraw accepted into the scene and then never rendered — it
 * resolves the link before consulting this predicate. `.invalid` is reserved
 * by RFC 2606 and resolves nowhere, so the URL is inert even if something ever
 * tried to follow it.
 */
const validateEmbeddable = (link: string) => link.startsWith(NODE_LINK_PREFIX);

/**
 * Holistix shapes that Excalidraw draws itself.
 *
 * These need no embeddable and no React: they are the two of the twenty node
 * types that can live in a canvas, so they are projected as native elements
 * and cost the scene a shape rather than a DOM subtree.
 *
 * The other six — hexagon, plus, parallelogram, cylinder, arrow-rectangle,
 * triangle — have no native equivalent and stay embeddables. Drawing them as
 * polygons would be a second rendering of something the node component
 * already draws, and the two would drift.
 */
const NATIVE_SHAPES: Record<string, { type: string; roundness?: number }> = {
  circle: { type: 'ellipse' },
  diamond: { type: 'diamond' },
  square: { type: 'rectangle' },
  'round-rectangle': { type: 'rectangle', roundness: 3 },
};

/**
 * The box the scene gives a node: the node's own size, plus the margin.
 *
 * The size is the node's, never the box's — the view's if it has one, the
 * measured one otherwise, and 320x220 for the one frame before it has been
 * drawn and can be measured. The margin is then added on every side, so it
 * is room around the node rather than room taken out of it.
 *
 * Getting that the wrong way round is what this had to be rewritten for: with
 * the margin subtracted from a box the user had dragged, a node they had just
 * sized to fit came out clipped by exactly the margin.
 *
 * The default is why every card wider than 320 used to be cut off. The
 * ReactFlow canvas sets no width at all on an unsized node and lets it take
 * the room it needs; an element in a scene has to be given a box before
 * anything can be drawn in it, and 320 was that box.
 */
export const nodeBoxSize = (
  size: { width?: number; height?: number } | undefined,
  measured: { width: number; height: number } | undefined
): { width: number; height: number } => ({
  width: (size?.width ?? measured?.width ?? 320) + 2 * EMBED_MARGIN,
  height: (size?.height ?? measured?.height ?? 220) + 2 * EMBED_MARGIN,
});

/**
 * The scene, laid out back to front.
 *
 * Excalidraw's array *is* the paint order, so this is the whole of what a
 * layer does. Used when the stack itself changes — a layer dragged in the
 * panel — to put the blocks back in the order the stack now says.
 *
 * It is not an invariant enforced on every change. Excalidraw already has
 * send-to-back and bring-to-front, and those stay meaningful: an element
 * pushed past a boundary *changes layer*, which `layerFromPosition` below
 * reads back. The stack decides where blocks sit; the user's own ordering
 * decides which block a thing is in.
 *
 * Stable within a layer, so two elements on the same one keep the order the
 * scene gave them.
 *
 * An element with no layer sorts to the bottom, which is where it was when
 * the bottom was the only place there was — so a board that predates layers
 * is unchanged, without a migration.
 */
export const byLayerOrder = <
  T extends { customData?: Record<string, unknown> }
>(
  elements: T[],
  stack: { id: string }[]
): T[] => {
  if (stack.length < 2) return elements;

  const rank = new Map(stack.map((layer, i) => [layer.id, i]));
  const of = (e: T) =>
    rank.get(elementLayerId(e as unknown as TJsonObject) ?? '') ?? -1;

  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => of(a.element) - of(b.element) || a.index - b.index)
    .map(({ element }) => element);
};

/**
 * The layer an element has moved into, if it has moved out of its own.
 *
 * Excalidraw's send-to-back and bring-to-front reorder the scene, and the
 * scene is where layers live — so pushing an element past a boundary is how
 * you move it to the layer behind. Membership follows position; the
 * alternative was to sort it back into its block, which would have made those
 * two commands do nothing across a boundary and look broken.
 *
 * The scene is meant to read back to front, so an element that breaks that
 * order is the one that moved — and it moved into the layer of whatever it
 * jumped over. A first attempt asked its neighbours instead, and that pushed
 * an element which is simply the only one on its layer into its neighbour's:
 * at an end there is one neighbour, and one neighbour is not a vote.
 *
 * Returns only the changes, keyed by element id, so the caller writes nothing
 * for a scene nobody reordered.
 */
export const layerFromPosition = <
  T extends { id: string; customData?: Record<string, unknown> }
>(
  elements: T[],
  stack: { id: string }[]
): Map<string, string> => {
  const moved = new Map<string, string>();
  if (stack.length < 2 || elements.length < 2) return moved;

  const bottom = stack[0].id;
  const rank = new Map(stack.map((layer, i) => [layer.id, i]));
  const layerOf = (e: T) => {
    const id = elementLayerId(e as unknown as TJsonObject);
    return id && rank.has(id) ? id : bottom;
  };
  const rankOf = (e: T) => rank.get(layerOf(e)) ?? 0;

  elements.forEach((element, i) => {
    const mine = rankOf(element);
    const before = i > 0 ? rankOf(elements[i - 1]) : undefined;
    const after = i < elements.length - 1 ? rankOf(elements[i + 1]) : undefined;

    // Dropped further back than it belongs: it now sits before something of a
    // lower layer. The `before <= after` half is what tells a moved element
    // from the boundary between two blocks, where the break is expected.
    if (after !== undefined && mine > after && (before ?? -1) <= after) {
      moved.set(element.id, layerOf(elements[i + 1]));
      return;
    }

    // Pulled further forward than it belongs.
    if (before !== undefined && mine < before && (after ?? Infinity) >= before)
      moved.set(element.id, layerOf(elements[i - 1]));
  });

  return moved;
};

/** The scene element that stands for a node, by the node's own id. */
const elementIdForNode = (nodeId: string) => `holistix-node-${nodeId}`;

/** The node an element id stands for, or nothing if it is not one of ours. */
const nodeIdForElement = (elementId?: string) =>
  elementId?.startsWith('holistix-node-')
    ? elementId.slice('holistix-node-'.length)
    : undefined;

/** The node a projected embeddable stands for, or nothing. */
export const embeddedNodeId = (element: {
  customData?: Record<string, unknown>;
}): string | undefined => {
  const id = element.customData?.['holistixNodeId'];
  return typeof id === 'string' ? id : undefined;
};

/**
 * Excalidraw reads this prop once, as a stable identity — an inline arrow here
 * is the React #185 loop. So it cannot close over the view, and the view
 * travels in `customData` beside the node id.
 */
const renderNode = (element: {
  customData?: Record<string, unknown>;
}): JSX.Element | null => {
  const nodeId = embeddedNodeId(element);
  const viewId = element.customData?.['holistixViewId'];
  if (!nodeId || typeof viewId !== 'string') return null;
  return <EmbeddedNode nodeId={nodeId} viewId={viewId} />;
};

//

export type TExcalidrawLayerPayload = {
  nodeId?: string;
  viewId?: string;
  /** Which of the drawing's layers new strokes land on. */
  layerId?: string;
};

export const ExcalidrawLayerComponent: FC<{
  viewId: string;
  active: boolean;
  viewport: LayerViewportAdapter;
  payload?: TExcalidrawLayerPayload;
}> = ({ viewId: viewIdProp, active, viewport, payload }) => {
  const viewId = payload?.viewId || viewIdProp;

  // The drawing belongs to the view. It used to be keyed on the id of the
  // ExcalidrawNode that stood for it, which only worked because opening the
  // layer meant clicking Edit on that node. The layer is the whiteboard now:
  // there is no node to key it on, and one view is one drawing.
  const drawingId = viewId;

  const dispatcher = useDispatcher<TLayerEvent>();
  const { updateLayerTree, updateLayerTrees } = useLayerContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Excalidraw, setExcalidraw] = useState<FC<any> | null>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  /**
   * Set when Excalidraw hands its API over, which it does after this
   * component's own effects have already run — so the projection has to be
   * told rather than read the ref.
   */
  const [apiReady, setApiReady] = useState(false);

  const toExcalidrawViewport = useCallback(
    (vp: { absoluteX: number; absoluteY: number; zoom: number }) => ({
      scrollX: vp.absoluteX,
      scrollY: vp.absoluteY,
      zoom: { value: vp.zoom },
    }),
    []
  );

  //

  useEffect(() => {
    return viewport.registerViewportChangeCallback((vp) => {
      if (apiRef.current) {
        const state = apiRef.current.getAppState();
        apiRef.current.updateScene({
          appState: { ...state, ...toExcalidrawViewport(vp) },
        });
      }
    });
  }, [viewport, toExcalidrawViewport]);

  //

  useEffect(() => {
    if (!active || Excalidraw) return;
    (async () => {
      await ensureCss();
      const mod = await import('@excalidraw/excalidraw');
      setExcalidraw(() => (mod as { Excalidraw: FC }).Excalidraw);
    })();
  }, [active, Excalidraw]);

  //

  const handleScrollChange = useCallback(
    (scrollX: number, scrollY: number, zoom: { value: number }) => {
      viewport.onViewportChange({
        absoluteX: scrollX,
        absoluteY: scrollY,
        zoom: zoom.value,
      });
    },
    [viewport]
  );

  // collaborative

  const users = useAwarenessUserList();
  // Build collaborators map from user list (using username as key)
  const collaborators = useMemo(() => {
    const map = new Map<SocketId, Collaborator>();
    users.forEach((u) => {
      map.set(u.username as SocketId, {
        username: u.username,
        color: { background: u.color, stroke: u.color },
      });
    });
    return map;
  }, [users]);

  //

  const sharedData = useSharedDataDirect<TExcalidrawSharedData>();

  /**
   * The stack, back to front.
   *
   * Shared, because two people must see the same order — an element's place
   * in the paint order is a fact about the board, not a preference.
   */
  const layers = useLocalSharedData<TExcalidrawSharedData>(
    ['excalidraw:layers'],
    (sd) => {
      const found: TExcalidrawLayer[] = [];
      sd['excalidraw:layers']?.forEach((layer: TExcalidrawLayer) => {
        if (layer.drawingId === viewId) found.push(layer);
      });
      return found.sort(
        (a, b) => a.order - b.order || a.id.localeCompare(b.id)
      );
    }
  ) as TExcalidrawLayer[];

  /**
   * Which layer a new stroke lands on. This user's choice, not the board's.
   *
   * It rides in the layer payload, which is per-client state the panel
   * already owns — rather than shared, because two people drawing on one
   * board are usually on different layers and sharing it would have each of
   * them moving the other's pen.
   *
   * The top of the stack by default: a new layer is made to be drawn on.
   */
  const activeLayerId = payload?.layerId;

  const stack = layers ?? [];
  const activeLayer =
    stack.find((l) => l.id === activeLayerId) ?? stack[stack.length - 1];

  /**
   * The two verbs the panel is allowed to use on this stack.
   *
   * Published with the stack rather than reached for: the panel draws layers
   * and does not know how one is made, and a panel that dispatched
   * `excalidraw:new-layer` itself would know one provider by name.
   *
   * In a ref because they are new closures on every render, and the panel
   * stores what it is given — handing it a fresh object each frame would
   * re-render every consumer of the layer context.
   */
  const layerActionsRef = useRef({
    addLayer: () =>
      dispatcher.dispatch({
        type: 'excalidraw:new-layer',
        drawingId: viewId,
        // Minted here so a stroke can land on it in the same breath, rather
        // than drawing into nowhere while waiting to be told its name.
        layerId: `layer-${Date.now().toString(36)}`,
        title: `Layer ${stackRef.current.length + 1}`,
      }),
    reorderLayers: (layerIds: string[]) =>
      dispatcher.dispatch({
        type: 'excalidraw:reorder-layers',
        drawingId: viewId,
        layerIds,
      }),
  });

  /** What the stack is, as a string, so an effect can depend on it. */
  const stackSignature = stack.map((l) => `${l.id}:${l.title}`).join('|');

  /** The stack, read from inside handlers that must not depend on it. */
  const stackRef = useRef<TExcalidrawLayer[]>([]);
  stackRef.current = stack;

  /** Where an element with no layer of its own belongs: the bottom. */
  const bottomLayerRef = useRef<string | undefined>(undefined);
  bottomLayerRef.current = stack[0]?.id;

  /**
   * Read by the flush, which is debounced and would otherwise close over the
   * layer that was active when it was created.
   */
  const activeLayerRef = useRef<string | undefined>(undefined);
  activeLayerRef.current = activeLayer?.id;

  /**
   * A board has at least one layer.
   *
   * Created on first sight rather than by a migration: a board that predates
   * layers has elements with no layer at all, and those belong at the bottom
   * of the stack whether or not the bottom has a name yet. Naming it is what
   * gives the panel something to list and the next stroke somewhere to go.
   */
  /**
   * The rows the scene last produced, kept so the stack can be republished
   * without waiting for the next stroke.
   */
  const itemsByLayer = useRef<Map<string, TLayerTreeItem[]>>(new Map());

  /**
   * The panel's section: one entry per layer, front of the stack first.
   *
   * Front first because a layers panel is read top-down as the eye reads the
   * board front-to-back — the convention every drawing tool shares.
   */
  const publishLayers = useCallback(() => {
    updateLayerTrees?.(
      'excalidraw',
      [...stackRef.current].reverse().map((layer) => ({
        layerId: layer.id,
        title: layer.title,
        items: itemsByLayer.current.get(layer.id) ?? [],
      })),
      layerActionsRef.current
    );
  }, [updateLayerTrees]);

  /**
   * Publish when the stack changes, and not only when the scene does.
   *
   * Published from `onChange` alone, a layer someone had just created did not
   * reach the panel until the next stroke — so the `+` looked like it had
   * done nothing, which is how this was found.
   */
  useEffect(() => {
    if (active) publishLayers();
  }, [active, stackSignature, publishLayers]);

  const askedForFirst = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !layers || stack.length) return;
    // Once per drawing, not once per render. The write takes a round trip
    // through the gateway, and the effect runs again on every render until it
    // lands — which sent the same request five times before the first reply.
    if (askedForFirst.current === viewId) return;
    askedForFirst.current = viewId;

    dispatcher.dispatch({
      type: 'excalidraw:new-layer',
      drawingId: viewId,
      layerId: 'layer-1',
      title: 'Layer 1',
    });
  }, [active, layers, stack.length, dispatcher, viewId]);

  /** What we last pushed, so a change is diffed rather than resent whole. */
  const sentVersions = useRef<Map<string, number>>(new Map());
  /** Latest scene, read by the flush instead of captured by it. */
  const pendingElements = useRef<readonly OrderedExcalidrawElement[]>([]);
  /** The scene the last onChange acted on — see the note in handleChange. */
  const lastSignature = useRef<string | null>(null);

  const { awareness } = useAwareness();
  /** The selection last announced, so an unchanged one is not re-announced. */
  const lastSelection = useRef<string>('');

  // The graph's nodes, projected into the scene as embeddables.
  //
  // They are *not* part of the drawing: the graph already owns them, and
  // writing them into `excalidraw:elements` would give every node two homes
  // that drift apart. They are injected locally and excluded from the flush.
  const graphView = useLocalSharedData<TWhiteboardSharedData>(
    ['whiteboard:graphViews'],
    // Only while the surface is on screen: this subscribes the layer to every
    // graph change, and an inactive layer has nothing to project into.
    (sd) => (active ? sd['whiteboard:graphViews']?.get(viewId) : undefined)
  );

  const nodeViews: TNodeView[] = useMemo(
    () => graphView?.nodeViews ?? [],
    [graphView?.nodeViews]
  );

  // The node's own data — its shape type, its colours — lives in
  // `core-graph:nodes`. The view's `graph.nodes` carries only id, type,
  // status and position, which is enough to lay a node out and not enough to
  // know a circle from a hexagon; reading it instead left every shape an
  // embeddable.
  const graphNodes = useLocalSharedData<TCoreSharedData>(
    ['core-graph:nodes'],
    (sd) => (active ? sd['core-graph:nodes'] : undefined)
  );

  // The graph's edges, drawn as Excalidraw's own arrows. The spike showed a
  // native arrow binds to an embeddable the way it binds to a shape, so an
  // edge needs no element of ours at all — only the two ids to bind to.
  const graphEdges = useLocalSharedData<TCoreSharedData>(
    ['core-graph:edges'],
    (sd) => (active ? sd['core-graph:edges'] : undefined)
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, TGraphNode<never>>();
    graphNodes?.forEach?.((node: TGraphNode<never>, id: string) =>
      map.set(id, node)
    );
    return map;
  }, [graphNodes]);
  const latestNodes = useRef(nodesById);
  latestNodes.current = nodesById;
  const edgeList = useMemo(() => {
    const out: { from: string; to: string }[] = [];
    (
      graphEdges as unknown as { forEach?: (f: (e: TEdge) => void) => void }
    )?.forEach?.((e: TEdge) => {
      if (e?.from?.node && e?.to?.node)
        out.push({ from: e.from.node, to: e.to.node });
    });
    return out;
  }, [graphEdges]);

  const latestEdges = useRef(edgeList);
  latestEdges.current = edgeList;

  const edgesRevision = useMemo(
    () => edgeList.map((e) => `${e.from}>${e.to}`).join('|'),
    [edgeList]
  );

  /** Changes when the set of nodes or their types does, so the signature can
   * depend on it without depending on an array rebuilt on every change. */
  const nodesRevision = useMemo(
    () =>
      [...nodesById.values()]
        .map(
          (n) =>
            `${n.id}:${n.type}:${
              (n.data as { shapeType?: string } | undefined)?.shapeType ?? ''
            }`
        )
        .join('|'),
    [nodesById]
  );

  /** Arrows already turned into edges, so one is not sent twice. */
  const sentEdges = useRef<Set<string>>(new Set());

  /**
   * The nodes the last projection actually drew.
   *
   * Guards the only destructive path this layer has. See where it is filled.
   */
  const projectedNodeIds = useRef<Set<string>>(new Set());

  /** Where the projection last put each node — see the write-back below. */
  const projectedGeometry = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  /** Read by the projection effect, so its identity is not a dependency. */
  const latestNodeViews = useRef<TNodeView[]>(nodeViews);
  latestNodeViews.current = nodeViews;

  /**
   * How big each node turned out to be, once drawn.
   *
   * Only consulted for a node whose view carries no size — that is the case
   * the scene cannot handle on its own, since an element needs a box before
   * anything can be drawn in it while a DOM node simply takes the room it
   * needs. Kept in a ref and paired with a counter: the projection reads the
   * map, and the counter is what tells it to look again.
   */
  const measured = useRef(new Map<string, { width: number; height: number }>());
  const [measureTick, setMeasureTick] = useState(0);

  /**
   * Debounced, because the first paint reports every node at once and each
   * report would otherwise re-project the whole scene. One pixel of noise is
   * ignored for the same reason — a card that reflows by a hair should not
   * move the box around it.
   */
  const bumpMeasureTick = useMemo(
    () => debounce(() => setMeasureTick((t) => t + 1), 120),
    []
  );

  const reportSize = useCallback(
    (nodeId: string, size: { width: number; height: number }) => {
      const known = measured.current.get(nodeId);
      if (
        known &&
        Math.abs(known.width - size.width) < 2 &&
        Math.abs(known.height - size.height) < 2
      )
        return;
      measured.current.set(nodeId, size);
      bumpMeasureTick();
    },
    [bumpMeasureTick]
  );

  useEffect(() => () => bumpMeasureTick.cancel(), [bumpMeasureTick]);

  /** Rebuilt whenever a node moves, is added, removed or changes shape. */
  const nodeSignature = useMemo(
    () =>
      nodeViews
        .map((nv) => {
          const node = latestNodes.current.get(nv.id);
          const shapeType = (node?.data as { shapeType?: string } | undefined)
            ?.shapeType;
          // The shape type is in here because it decides whether the node is
          // projected as a native element or as an embeddable, and the graph's
          // nodes arrive separately from its views — keyed on the views alone,
          // a shape loaded second stayed an embeddable forever.
          return `${nv.id}@${Math.round(nv.position.x)},${Math.round(
            nv.position.y
          )}:${nv.size?.width ?? 0}x${nv.size?.height ?? 0}:${
            shapeType ?? node?.type ?? ''
          }`;
        })
        .join('|'),
    [nodeViews, nodesRevision, edgesRevision]
  );

  /**
   * Injected after mount, deliberately.
   *
   * Excalidraw validates an embeddable in `updateEmbeddables()`, and that runs
   * from `componentDidUpdate` only — never from `componentDidMount`
   * (App.tsx:2704 in 0.18.0). An element present in `initialData` is therefore
   * never validated, `embedsValidationStatus` has no entry for it, and
   * `renderEmbeddables()` filters it out:
   *
   *     .filter(a => isIframeLikeElement(a) &&
   *                  this.embedsValidationStatus.get(a.id) === true || ...)
   *
   * So the nodes go in through `updateScene`, whose update cycle is what gets
   * them validated.
   */
  useEffect(() => {
    const api = apiRef.current;
    if (!active || !api) return;
    // On by default — a surface with no nodes on it is not the whiteboard.
    // Measured to 2000 nodes: the page holds, and Excalidraw only builds a
    // container for an embeddable it is drawing, so the projection costs what
    // the viewport shows rather than what the graph holds.
    //
    // Escapable the same way as the surface itself:
    //   localStorage.setItem('holistix:excalidraw-nodes', '0')
    if (localStorage.getItem('holistix:excalidraw-nodes') === '0') return;

    let cancelled = false;

    (async () => {
      const { convertToExcalidrawElements, restoreElements } = (await import(
        '@excalidraw/excalidraw'
      )) as unknown as {
        convertToExcalidrawElements: (
          skeletons: unknown[]
        ) => OrderedExcalidrawElement[];
        restoreElements: (
          elements: unknown,
          localElements: unknown
        ) => OrderedExcalidrawElement[];
      };
      if (cancelled) return;

      const scene = api.getSceneElementsIncludingDeleted?.() ?? [];
      const drawing = scene.filter(
        (e) => !embeddedNodeId(e) && !e.customData?.['holistixEdge']
      );

      const views = latestNodeViews.current;
      const nodesById = latestNodes.current;

      const skeletons = views.map((nv) => {
        const common = {
          x: nv.position.x,
          y: nv.position.y,
          ...nodeBoxSize(nv.size, measured.current.get(nv.id)),
          customData: { holistixNodeId: nv.id, holistixViewId: viewId },
        };

        const node = nodesById.get(nv.id);

        // A group is a frame. That is Excalidraw's own word for "these
        // elements belong together and move together", and it comes with
        // the name, the drag behaviour and the membership — none of which
        // an embeddable would have.
        if (node?.type === 'group') {
          const title = (node.data as { title?: string } | undefined)?.title;
          return {
            ...common,
            type: 'frame',
            name: title ?? 'Group',
            // Mandatory, and empty on purpose.
            //
            // `convertToExcalidrawElements` walks `children` unconditionally
            // for a frame — `element.children.forEach(...)`, no guard — so a
            // skeleton without the key threw, and the throw was inside the
            // async projection where nothing catches it. One group node on a
            // board therefore blanked *every* node on it, silently: the
            // canvas drew, the layers panel listed its shapes, and not one
            // service card appeared.
            //
            // Empty rather than populated because membership is already
            // ours: `identified` sets `frameId` from the view's `parentId`
            // below. Excalidraw's own path wants ids that exist in this same
            // batch and throws on any it cannot map — which our node ids,
            // assigned after the conversion, are not.
            children: [],
          };
        }

        const shapeType =
          node?.type === 'shape'
            ? (node.data as { shapeType?: string } | undefined)?.shapeType
            : undefined;
        const native = shapeType ? NATIVE_SHAPES[shapeType] : undefined;

        if (native) {
          const data = node?.data as
            | {
                borderColor?: string;
                fillColor?: string;
                fillOpacity?: number;
              }
            | undefined;

          // A shape node carries its fill and a separate opacity for it,
          // and the default is 0 — an outline. Excalidraw has no separate
          // fill opacity, so a transparent fill is the absence of a
          // background rather than a background at zero.
          const filled = (data?.fillOpacity ?? 0) > 0;

          // Square unless the view says otherwise: the 320x220 default is a
          // node's box, and a circle in it comes out an ellipse.
          const side = nv.size?.width ?? 320;
          return {
            ...common,
            width: nv.size?.width ?? side,
            height: nv.size?.height ?? side,
            type: native.type,
            roundness: native.roundness
              ? { type: native.roundness }
              : undefined,
            strokeColor: data?.borderColor ?? '#672aa4',
            backgroundColor: filled
              ? data?.fillColor ?? 'transparent'
              : 'transparent',
          };
        }

        // Everything else is React, and needs the link — see nodeLink.
        return { ...common, type: 'embeddable', link: nodeLink(nv.id) };
      });

      // Loudly, if a skeleton is malformed.
      //
      // This conversion throws on bad input and it runs inside an async
      // effect, so the rejection went nowhere: the board came up with a
      // working canvas, a populated layers panel and no nodes at all, which
      // reads as "the node was deleted" rather than as a crash. It cost a day.
      //
      // Still fatal to the projection — one skeleton cannot be dropped
      // without dropping its view, and the two are matched by index below —
      // but no longer silent.
      let projected: OrderedExcalidrawElement[];
      try {
        projected = convertToExcalidrawElements(skeletons);
      } catch (error) {
        console.error(
          '[whiteboard] node projection failed — no nodes drawn',
          error,
          skeletons
        );
        return;
      }

      // The id is derived from the node, and rewritten between the two calls
      // on purpose. `convertToExcalidrawElements` mints its own and ignores
      // the one the skeleton gives it, and Excalidraw caches an embeddable's
      // validation by id without ever evicting it — so a fresh id per
      // projection grows that map for as long as the board is open.
      //
      // Rewriting it *before* `restoreElements` matters: an id patched onto
      // an already-normalised element leaves a half-built object, which is
      // how the first attempt at this locked the tab up.
      // The edges, as Excalidraw's own arrows bound to the two elements they
      // join. Nothing of ours draws them: binding is the canvas's job, and it
      // keeps them attached while a node is dragged — which is the half of
      // the phase-2 bet the spike checked first.
      const known = new Set(views.map((nv) => nv.id));
      const arrows = latestEdges.current
        .filter((e) => known.has(e.from) && known.has(e.to))
        .map((e) => {
          const a = views.find((nv) => nv.id === e.from);
          const b = views.find((nv) => nv.id === e.to);
          const ax = (a?.position.x ?? 0) + (a?.size?.width ?? 320) / 2;
          const ay = (a?.position.y ?? 0) + (a?.size?.height ?? 220) / 2;
          const bx = (b?.position.x ?? 0) + (b?.size?.width ?? 320) / 2;
          const by = (b?.position.y ?? 0) + (b?.size?.height ?? 220) / 2;
          return {
            type: 'arrow',
            x: ax,
            y: ay,
            width: bx - ax,
            height: by - ay,
            strokeColor: '#672aa4',
            start: { id: elementIdForNode(e.from) },
            end: { id: elementIdForNode(e.to) },
            customData: { holistixEdge: `${e.from}>${e.to}` },
          };
        });

      const identified = projected.map((element, i) => ({
        ...element,
        id: elementIdForNode(views[i].id),
        // Membership of a group is membership of its frame. The view already
        // says which group a node is in; Excalidraw then moves the two
        // together without anything of ours arranging it.
        ...(views[i].parentId
          ? { frameId: elementIdForNode(views[i].parentId as string) }
          : {}),
      }));

      const arrowElements = arrows.length
        ? convertToExcalidrawElements(arrows)
        : [];

      // Normalised before it goes in. `convertToExcalidrawElements` leaves an
      // embeddable with only the fields the skeleton named — no `angle`, no
      // `opacity`, no `seed` — and Excalidraw's viewport test needs them: the
      // element validated fine and was then judged invisible, so it never
      // rendered. Measured: 12 fields against the 27 a real element carries.
      const restored = restoreElements([...identified, ...arrowElements], null);

      // What the graph says each node's box is. The write-back compares the
      // scene against this: without it, projecting a position would read back
      // as a move and be dispatched straight back to the graph.
      // The same box the projection just drew, and not the view's size: they
      // differ by the margin, and by the whole of it for a node that has
      // never been sized. Read from the view alone, growing a box to fit its
      // node came back as a resize the user never made — and was written to
      // the graph as one.
      projectedGeometry.current = new Map(
        views.map((nv) => [
          nv.id,
          {
            x: nv.position.x,
            y: nv.position.y,
            ...nodeBoxSize(nv.size, measured.current.get(nv.id)),
          },
        ])
      );

      // Exactly the nodes this projection put in the scene.
      //
      // The write-back consults it before deleting anything: `updateScene`
      // replaces the element list, so a node missing from what *we* wrote
      // comes back tombstoned on the next change — and that tombstone is
      // ours, not a person reaching for the eraser. Read as an erasure, it
      // deleted a real node from a real board. It did, once, on the test
      // board, and the service behind it went on running with nothing left
      // pointing at it.
      projectedNodeIds.current = new Set(views.map((nv) => nv.id));

      api.updateScene({
        elements: byLayerOrder([...drawing, ...restored], stackRef.current),
      });
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the signature alone. `nodeViews` is a fresh array on every
    // shared-data change and this effect causes one, so depending on it is a
    // loop — it froze the tab. The signature is what says a node moved.
  }, [active, nodeSignature, viewId, apiReady, measureTick]);

  // Pull remote changes into the scene.
  //
  // Excalidraw's own reconciler decides element by element, on
  // `version`/`versionNonce`. The previous code compared a `fromUser` field on
  // the whole drawing and, when it differed, replaced the entire scene — so
  // two people drawing at once overwrote each other wholesale.
  useEffect(() => {
    // Nothing to pull into a layer that is not on screen. This used to be
    // implied: the drawing was keyed on a node, and the id only arrived in the
    // payload when someone opened the layer. Keying it on the view made the id
    // always present, so every board — including those never showing a drawing
    // — subscribed to the element map and pushed into an Excalidraw that was
    // not mounted.
    if (!active || !drawingId) return;
    const map = sharedData['excalidraw:elements'];

    const pull = async () => {
      const api = apiRef.current;
      if (!api) return;

      const { reconcileElements, getSceneVersion } = (await import(
        '@excalidraw/excalidraw'
      )) as unknown as {
        reconcileElements: (
          local: readonly OrderedExcalidrawElement[],
          remote: readonly OrderedExcalidrawElement[],
          appState: AppState
        ) => OrderedExcalidrawElement[];
        getSceneVersion: (e: readonly OrderedExcalidrawElement[]) => number;
      };

      const remote = readDrawingElements(
        sharedData,
        drawingId
      ) as unknown as readonly OrderedExcalidrawElement[];
      const local = api.getSceneElementsIncludingDeleted?.() ?? [];
      const reconciled = reconcileElements(local, remote, api.getAppState());

      // Our own write comes back through this same observer. Applying it again
      // would feed the loop, so only touch the scene when it actually differs.
      if (getSceneVersion(reconciled) === getSceneVersion(local)) return;

      // Only what actually came from the shared map counts as sent.
      //
      // `reconcileElements` returns the union of local and remote, so recording
      // the whole reconciliation marked the strokes someone had just drawn —
      // still sitting in the 250 ms debounce, never dispatched — as already
      // saved. The next flush then found no delta and dropped them: they
      // vanished for everyone else and did not survive a reload, and only came
      // back if the element happened to be edited again.
      const merged = new Map(sentVersions.current);
      for (const [id, version] of versionsById(
        remote as unknown as TJsonObject[]
      )) {
        merged.set(id, version);
      }
      sentVersions.current = merged;

      api.updateScene({ elements: reconciled });
    };

    map.observe(pull);
    pull();
    // The previous version never unobserved: every mount left a listener
    // behind, still writing into the scene of a component that was gone.
    return () => map.unobserve(pull);
  }, [active, drawingId, sharedData]);

  //

  /**
   * Recomputes the delta from the current scene on every run rather than
   * carrying one in, so a debounced-away change is never a lost change.
   */
  const flush = useMemo(
    () =>
      debounce(
        async () => {
          if (!drawingId) return;

          // Projected nodes are the graph's, not the drawing's. Letting them
          // through would write every node into `excalidraw:elements` as well,
          // so each would exist twice and the two copies would drift.
          const elements = pendingElements.current.filter(
            (e) => !embeddedNodeId(e)
          );
          const current = versionsById(elements as unknown as TJsonObject[]);

          /**
           * Where each element belongs now.
           *
           * Two ways an element gets a layer. A new one joins the layer its
           * author was working on — only a new one, or every edit would drag
           * the whole scene onto whichever layer the editor had selected. And
           * an existing one pushed past a boundary by send-to-back or
           * bring-to-front moves to the layer it landed in, which is what
           * makes those two commands mean something across layers instead of
           * being quietly undone.
           *
           * Within a layer nothing changes: the order of the elements is
           * still what says which is in front, and Excalidraw's own commands
           * are what change it.
           */
          const relocated = layerFromPosition(
            pendingElements.current as unknown as {
              id: string;
              customData?: Record<string, unknown>;
            }[],
            stackRef.current
          );

          const withLayer = (e: OrderedExcalidrawElement) => {
            const own = elementLayerId(e as unknown as TJsonObject);
            const layer = relocated.get(e.id) ?? own ?? activeLayerRef.current;
            if (!layer || layer === own) return e;
            return {
              ...e,
              customData: { ...(e.customData ?? {}), holistixLayer: layer },
            } as OrderedExcalidrawElement;
          };

          // A move past a boundary changes no version — Excalidraw renumbers
          // on a mutation, not on a reorder — so the version gate alone would
          // drop it and the element would snap back on the next reload.
          const upserts = elements
            .filter(
              (e) =>
                sentVersions.current.get(e.id) !== e.version ||
                relocated.has(e.id)
            )
            .map(withLayer);
          const deletedIds = [...sentVersions.current.keys()].filter(
            (id) => !current.has(id)
          );

          sentVersions.current = current;

          if (upserts.length) {
            await dispatcher.dispatch({
              type: 'excalidraw:upsert-elements',
              drawingId: drawingId,
              elements: upserts as unknown as TJsonObject[],
            });
          }
          if (deletedIds.length) {
            await dispatcher.dispatch({
              type: 'excalidraw:delete-elements',
              drawingId: drawingId,
              elementIds: deletedIds,
            });
          }

          // An arrow drawn between two nodes becomes an edge in the graph.
          //
          // Excalidraw binds an arrow to what it lands on, so the two ends are
          // already the elements it joined — there is no hit testing to do
          // here, only a translation back to node ids. Arrows the projection
          // put there are skipped: they carry `holistixEdge` and are already
          // the graph's.
          for (const element of pendingElements.current) {
            const el = element as unknown as {
              type?: string;
              id: string;
              isDeleted?: boolean;
              customData?: Record<string, unknown>;
              startBinding?: { elementId?: string } | null;
              endBinding?: { elementId?: string } | null;
            };
            if (el.type !== 'arrow' || el.isDeleted) continue;
            if (el.customData?.['holistixEdge']) continue;
            if (sentEdges.current.has(el.id)) continue;

            const from = nodeIdForElement(el.startBinding?.elementId);
            const to = nodeIdForElement(el.endBinding?.elementId);
            // An arrow with a loose end is a drawing, not an edge.
            if (!from || !to || from === to) continue;

            sentEdges.current.add(el.id);
            await dispatcher.dispatch({
              type: 'core:new-edge',
              edge: {
                from: { node: from, connectorName: 'outputs' },
                to: { node: to, connectorName: 'inputs' },
                semanticType: 'easy-connect',
              },
            });
          }

          // A node erased on the surface is erased in the graph. Excalidraw
          // tombstones rather than removes, so a deletion arrives as our own
          // element carrying `isDeleted` — and the projection would put it
          // straight back if the graph still held the node.
          for (const element of pendingElements.current) {
            const nodeId = embeddedNodeId(element);
            if (!nodeId || !element.isDeleted) continue;
            if (!projectedGeometry.current.has(nodeId)) continue;

            // Only a node the last projection actually drew. A tombstone for
            // one it did not is the projection's own doing — an incomplete
            // write, a graph view not loaded yet — and deleting the node
            // because of it destroys work nobody asked to destroy.
            if (!projectedNodeIds.current.has(nodeId)) continue;

            // Forgotten first, so the projection's next run does not read the
            // tombstone as a move and the delete is not sent twice.
            projectedGeometry.current.delete(nodeId);

            await dispatcher.dispatch({
              type: 'core:delete-node',
              id: nodeId,
            });
          }

          // A node moved on the surface goes back to the graph, which owns it.
          //
          // Only a difference against what the projection last wrote counts:
          // the projection puts the graph's own position into the scene, and
          // reading that back as a move would dispatch it straight home again,
          // forever. Rounded to the pixel because Excalidraw carries
          // sub-pixel geometry and the graph does not.
          for (const element of pendingElements.current) {
            const nodeId = embeddedNodeId(element);
            if (!nodeId || element.isDeleted) continue;

            const was = projectedGeometry.current.get(nodeId);
            if (!was) continue;

            const moved =
              Math.round(element.x) !== Math.round(was.x) ||
              Math.round(element.y) !== Math.round(was.y);
            const resized =
              Math.round(element.width) !== Math.round(was.width) ||
              Math.round(element.height) !== Math.round(was.height);
            if (!moved && !resized) continue;

            // Recorded before dispatching, so the echo of this write is not
            // read as another move.
            projectedGeometry.current.set(nodeId, {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
            });

            if (moved) {
              await dispatcher.dispatch({
                type: 'whiteboard:move-node',
                viewId,
                nid: nodeId,
                position: { x: element.x, y: element.y },
              });
            }
            if (resized) {
              // The margin comes back off: what the graph stores is the
              // node's size, and the box the user dragged is that plus the
              // margin. Stored as the box, the next projection would add the
              // margin again and the node would grow by 16px per resize.
              await dispatcher.dispatch({
                type: 'whiteboard:resize-node',
                viewId,
                nid: nodeId,
                size: {
                  width: Math.max(1, element.width - 2 * EMBED_MARGIN),
                  height: Math.max(1, element.height - 2 * EMBED_MARGIN),
                },
              });
            }
          }
        },
        250,
        { maxWait: 250 }
      ),
    [dispatcher, drawingId, viewId]
  );

  /**
   * What to call an element that stands for a node.
   *
   * `undefined` for anything else, so the caller keeps its own naming for a
   * rectangle or a line — this only answers for the elements that have a
   * better name available.
   */
  const nodeTitle = useCallback(
    (element: { customData?: Record<string, unknown> }): string | undefined => {
      const nodeId = embeddedNodeId(element);
      if (!nodeId) return undefined;
      const node = latestNodes.current.get(nodeId);
      return node?.name || node?.type || undefined;
    },
    []
  );

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], state?: AppState) => {
      pendingElements.current = elements;

      // Selecting a node on the surface is selecting the node, so the other
      // people on the board see it. Excalidraw's selection is by element; the
      // ones that stand for a node are translated back, and the drawing's own
      // elements are not announced — the graph has no word for them.
      //
      // Announced only on a change: onChange fires for everything, and
      // awareness is a broadcast to every peer.
      if (state?.selectedElementIds) {
        const selectedNodes = elements
          .filter((e) => state.selectedElementIds[e.id])
          .map((e) => embeddedNodeId(e))
          .filter((id): id is string => !!id)
          .sort();
        const key = selectedNodes.join(',');
        if (key !== lastSelection.current) {
          lastSelection.current = key;
          awareness.emitSelectionAwareness({ nodes: selectedNodes, viewId });
        }
      }

      // Everything below reaches out of this component — the layer tree lives
      // in the whiteboard's state, and the flush dispatches. Excalidraw calls
      // onChange for `appState` too, including the viewport writes this layer
      // makes itself, so without this the handler answers its own echo:
      // onChange → updateLayerTree → whiteboard re-render → updateScene →
      // onChange. That loop is what took the whole editor down with React's
      // "maximum update depth", and it did so from whichever component
      // happened to hold a Radix popper — never from anything named
      // Excalidraw, which is why it read as a third-party problem.
      const signature = sceneSignature(elements as unknown as TJsonObject[]);
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;

      // Update tree data for the layer panel
      if (updateLayerTree && drawingId) {
        const alive = elements.filter((e) => !e.isDeleted);
        const rowFor = (
          element: (typeof alive)[number],
          index: number
        ): TLayerTreeItem => ({
          // Keyed on the element's own id, not its position in the array:
          // indices shift on every delete, so the tree used to re-label and
          // re-target its rows behind the user's back.
          id: `${drawingId}-element-${element.id}`,
          type: 'node',
          // An embeddable is a node, and calling it "Embeddable 3" says
          // nothing anyone can act on. Its name comes from the graph, which
          // is where a node's name lives; the element only carries the id.
          //
          // This is also the whole reason the board no longer lists its
          // nodes twice. It used to have a second layer for them — properly
          // named there, and named "Embeddable 3" here — which is two
          // listings of one board, disagreeing.
          title:
            nodeTitle(element) ??
            (element.type === 'text'
              ? element.text || `Text ${index + 1}`
              : `${
                  element.type.charAt(0).toUpperCase() + element.type.slice(1)
                } ${index + 1}`),
          level: 1,
          visible: true,
          expanded: false,
          locked: false,
          nodeData: {
            id: `${drawingId}-element-${element.id}`,
            type: 'excalidraw-element',
            position: { x: element.x, y: element.y },
            status: {
              mode: 'EXPANDED' as const,
              forceOpened: false,
              forceClosed: false,
              isFiltered: false,
              rank: 0,
              maxRank: 1,
            },
          },
          layerId: 'excalidraw',
        });

        /**
         * A frame's contents go inside it.
         *
         * Excalidraw says which frame an element belongs to and then keeps
         * the scene flat, so the panel listed a group and its contents as
         * siblings — the one arrangement that makes a group look like a
         * neighbour. Grouping here is reading a fact the scene already
         * carries, not inventing one.
         */
        const inFrame = new Map<string, TLayerTreeItem[]>();
        alive.forEach((element, index) => {
          const frameId = (element as { frameId?: string | null }).frameId;
          if (!frameId) return;
          const kids = inFrame.get(frameId) ?? [];
          kids.push(rowFor(element, index));
          inFrame.set(frameId, kids);
        });

        const treeItems: TLayerTreeItem[] = alive
          .filter((e) => !(e as { frameId?: string | null }).frameId)
          .map((element, index) => {
            const row = rowFor(element, index);
            const children = inFrame.get(element.id);
            return children?.length
              ? { ...row, type: 'group' as const, children }
              : row;
          });

        /**
         * One panel entry per layer, front of the stack first.
         *
         * Reversed because a layers panel is read top-down as the eye reads
         * the board front-to-back — the row at the top is the thing in front,
         * which is the convention every drawing tool shares.
         */
        const byLayer = new Map<string, TLayerTreeItem[]>();
        treeItems.forEach((row) => {
          const id =
            elementLayerId(
              (alive.find((e) => `${drawingId}-element-${e.id}` === row.id) ??
                {}) as unknown as TJsonObject
            ) ?? bottomLayerRef.current;
          if (!id) return;
          const kids = byLayer.get(id) ?? [];
          kids.push(row);
          byLayer.set(id, kids);
        });

        itemsByLayer.current = byLayer;
        publishLayers();
      }

      flush();
    },
    [
      flush,
      drawingId,
      updateLayerTree,
      updateLayerTrees,
      awareness,
      viewId,
      nodeTitle,
    ]
  );

  // mode switch, collaborators update, content update

  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.updateScene({
        appState: {
          ...apiRef.current.getAppState(),
          ...ownedAppState,
          collaborators,
        },
      });
    }
  }, [collaborators]);

  // Cancel debounce on unmount, clear layer tree
  useEffect(() => {
    return () => {
      flush.cancel();
      if (drawingId) updateLayerTrees?.('excalidraw', []);
    };
  }, [flush, updateLayerTrees, drawingId]);

  //
  //
  //
  //

  if (!active) return null;
  if (!Excalidraw) return null;

  const initialVp = viewport.getViewport
    ? viewport.getViewport()
    : { absoluteX: 0, absoluteY: 0, zoom: 1 };

  return (
    <div
      className="excalidraw-layer"
      style={{ position: 'absolute', inset: 0 }}
    >
      {/*
        Every node Excalidraw draws is rendered inside this, so it can report
        how big it turned out to be. Excalidraw renders `renderEmbeddable`'s
        output inside its own tree, which is inside this one — the same reason
        a node can read the board's mode from here.
      */}
      <EmbeddedNodeMeasure value={reportSize}>
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawAPI) => {
            apiRef.current = api;
            setApiReady(true);
          }}
          initialData={{
            appState: {
              ...itemDefaults,
              ...ownedAppState,
              ...toExcalidrawViewport(initialVp),
            },
            elements: structuredClone(
              readDrawingElements(sharedData, drawingId)
            ) as unknown as OrderedExcalidrawElement[],
          }}
          onChange={handleChange}
          onScrollChange={handleScrollChange}
          // Module constants, never inline arrows: a fresh identity per render
          // sends Excalidraw into a re-render loop through its own ref
          // callbacks — React error #185 — before an embeddable even exists.
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderNode}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
              changeViewBackgroundColor: false,
              clearCanvas: false,
            },
            tools: {
              image: false,
            },
          }}
        />
      </EmbeddedNodeMeasure>
    </div>
  );
};

export const layer: TLayerProvider = {
  /**
   * The id stays `excalidraw` and the title does not.
   *
   * One is the registry key — what a saved payload and an allocation refer to
   * — and renaming it would break boards that already name it. The other is
   * what a person reads in the panel, and "Excalidraw" is the name of a
   * library we happen to draw with. Nobody using this board picked it, and
   * nothing about it tells them what the layer holds.
   *
   * `Layer 1` because there will be a second: the surface is the board now,
   * so layers are what a board is divided into rather than which renderer is
   * in charge.
   */
  id: 'excalidraw',
  title: LAYER_TITLE,
  zIndexHint: 10,
  Component: ExcalidrawLayerComponent,
};
