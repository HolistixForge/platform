import { FC, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  TPosition,
  TEdge,
  TCoreSharedData,
  TEventNewEdge,
  TEdgeEnd,
} from '@monorepo/core';
import { TGraphNode } from '@monorepo/module';
import {
  LayerViewportAdapter,
  PanelComponent,
  TSpaceMenuEntries,
  TLayerProvider,
} from '@monorepo/module/frontend';
import {
  useDispatcher,
  useAwareness,
  useSharedData,
  useShareDataManager,
  useEventSequence,
  FrontendEventSequence,
} from '@monorepo/collab-engine';

import { PointerTracker } from './PointerTracker';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { CollabSpaceState } from './collab-space-state';
import { useNodeContext } from './node-wrappers/node-wrapper';
import { CustomStoryNode } from './node';
import { TSpaceSharedData } from '../space-shared-model';
import { TEventEdgePropertyChange } from '../space-events';
import { TGraphView } from '../space-types';
import { ContextualMenu } from './contextual-menu';
import { edgeId, TEdgeRenderProps } from './apis/types/edge';
import { ReactflowLayerContext } from './reactflow-layer-context';
import { AvatarsRenderer } from './avatarsRenderer';
import { ReactflowLayer } from './reactflow-layer';
import { EdgeMenu } from './assets/edges/edge-menu';
import { CustomStoryEdge } from './edge';
import { RightPanels, usePanelContext } from './right-panels';
import { ModeIndicator } from './ModeIndicator';
import { LayersTreePanel } from './panels/layers-tree-panel';
import { LayerContextProvider } from './layer-context';
import { buildNodeTree } from '../layer-tree-utils';
import {
  TLayerTreeOperation,
  TLayerTreeItem,
  TLayerTreeCollection,
} from '../layer-tree-types';
import { isEqual } from 'lodash';

//

type TNodeTypes = { [key: string]: FC<{ node: TGraphNode }> };

//

export type WhiteboardMode = 'default' | 'move-node';

//

export type Viewport = {
  absoluteX: number;
  absoluteY: number;
  zoom: number;
};

//

export const INITIAL_VIEWPORT: Viewport = {
  absoluteX: 0,
  absoluteY: 0,
  zoom: 0.5,
};

//

const makeSpaceNode = (nodeTypes: TNodeTypes) => {
  return () => {
    const nodeContext = useNodeContext();
    const node: TGraphNode | undefined = useSharedData<TCoreSharedData>(
      ['nodes'],
      (sd) => sd.nodes.get(nodeContext.id)
    );

    if (node) {
      const NodeComponent = nodeTypes[node.type];

      if (NodeComponent) {
        return <NodeComponent node={node} />;
      }
    }

    return <CustomStoryNode data={node?.data} type={node?.type} />;
  };
};

//

const useOpenRadixContextMenu = () => {
  const triggerRef = useRef<HTMLSpanElement>(null);

  const open = useCallback((clientPosition: TPosition) => {
    triggerRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: clientPosition.x,
        clientY: clientPosition.y,
      })
    );
  }, []);

  return { triggerRef, open };
};

//

/**
 * #########################################################
 * HolistixSpace
 * @param param0
 * @returns
 */

export type HolistixSpaceProps = {
  viewId: string;
  nodeTypes: TNodeTypes;
  spaceMenuEntries: TSpaceMenuEntries;
  panelsDefs?: Record<string, PanelComponent>;
  layersProviders?: TLayerProvider[];
};

export const HolistixSpace = ({
  viewId,
  nodeTypes,
  spaceMenuEntries,
  panelsDefs,
  layersProviders,
}: HolistixSpaceProps) => {
  /**
   *
   */

  return (
    <RightPanels panelsDefs={panelsDefs}>
      <HolistixSpaceWhiteboard
        viewId={viewId}
        nodeTypes={nodeTypes}
        spaceMenuEntries={spaceMenuEntries}
        layersProviders={layersProviders}
      />
    </RightPanels>
  );
};

/**
 * #########################################################
 * HolistixSpaceContent
 * @param param0
 * @returns
 */

const HolistixSpaceWhiteboard = ({
  viewId,
  nodeTypes,
  spaceMenuEntries,
  layersProviders,
}: HolistixSpaceProps) => {
  //
  const sdm = useShareDataManager<TSpaceSharedData & TCoreSharedData>();

  const dispatcher = useDispatcher<TEventEdgePropertyChange | TEventNewEdge>();

  const { awareness } = useAwareness();

  const { openPanel, closePanel } = usePanelContext();

  const logics = useMemo(() => {
    const pt = new PointerTracker(viewId, awareness);
    const as = new HtmlAvatarStore(viewId, pt, awareness);
    return { pt, as };
  }, [viewId, awareness]);

  /**
   * Contextual menu logics
   */

  // right click coordinates
  const rcc = useRef<TPosition>({ x: 0, y: 0 });

  // new edge's origin handle
  const [from, setFrom] = useState<TEdgeEnd | undefined>(undefined);

  const { triggerRef: ContextualMenuTriggerRef, open: openContextualMenu } =
    useOpenRadixContextMenu();

  // capture the pointer coordinates in the canvas when user right click
  const handleContextualMenu = useCallback(
    (xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(undefined);
      openContextualMenu(clientPosition);
    },
    [openContextualMenu]
  );

  // callback when user draw an edge and end not to another connector.
  // Open a menu to propose creation of a new node.
  const handleContextualMenuNewEdge = useCallback(
    (from: TEdgeEnd, xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(from);
      openContextualMenu(clientPosition);
    },
    [openContextualMenu]
  );

  /**
   *
   */

  // Viewport state
  const lastViewportRef = useRef<Viewport>(INITIAL_VIEWPORT);

  const viewportChangeCallbacks = useRef<((viewport: Viewport) => void)[]>([]);

  // Viewport synchronization logic
  const onViewportChange = useCallback(
    (newViewport: Viewport) => {
      if (
        newViewport.absoluteX !== lastViewportRef.current.absoluteX ||
        newViewport.absoluteY !== lastViewportRef.current.absoluteY ||
        newViewport.zoom !== lastViewportRef.current.zoom
      ) {
        lastViewportRef.current = newViewport;
        logics.pt.onMove(newViewport);
        logics.as.updateAllAvatars();
        viewportChangeCallbacks.current.forEach((callback) => {
          callback(newViewport);
        });
      }
    },
    [logics.pt, logics.as]
  );

  const registerViewportChangeCallback = useCallback(
    (callback: (viewport: Viewport) => void) => {
      viewportChangeCallbacks.current.push(callback);
    },
    []
  );

  const viewport = useMemo(
    () => ({
      onViewportChange,
      registerViewportChangeCallback,
      getViewport: () => lastViewportRef.current,
    }),
    [onViewportChange, registerViewportChangeCallback]
  );

  //
  //

  const [activeLayer, setActiveLayer] = useState({
    layerId: 'reactflow',
    payload: {},
  });

  const activateLayer = useCallback((layerId: string, payload?: any) => {
    setActiveLayer({ layerId, payload });
  }, []);

  // Build tree collection for layer panel
  const [treeCollection, setTreeCollection] = useState<TLayerTreeCollection>(
    () => {
      return {
        layers: [
          {
            layerId: 'reactflow',
            title: 'Base layer',
            items: [],
          },
          ...(layersProviders?.map((provider) => ({
            layerId: provider.id,
            title: provider.title,
            items: [],
          })) || []),
        ],
      };
    }
  );

  // Handle tree operations
  const handleTreeOperation = useCallback((operation: TLayerTreeOperation) => {
    // TODO: Implement tree operations
    console.log('Tree operation:', operation);
  }, []);

  // Handle layer tree updates
  const handleUpdateLayerTree = useCallback(
    (layerId: string, items: TLayerTreeItem[], title: string) => {
      setTreeCollection((prev) => {
        const existingLayerIndex = prev.layers.findIndex(
          (layer) => layer.layerId === layerId
        );

        if (existingLayerIndex !== -1) {
          // Update existing layer in place
          return {
            layers: prev.layers.map((layer) => {
              if (layer.layerId === layerId) {
                return { layerId, items, title };
              }
              return layer;
            }),
          };
        } else {
          // Append new layer at the end
          return {
            layers: [...prev.layers, { layerId, items, title }],
          };
        }
      });
    },
    []
  );

  // Update reactflow layer tree data
  const previousTreeItemsRef = useRef<TLayerTreeItem[] | null>(null);
  const gv = sdm.getData().graphViews.get(viewId);
  const nodes = gv?.graph.nodes || [];
  const nodeViews = gv?.nodeViews || [];
  const treeItems = buildNodeTree(nodes, nodeViews);
  if (!isEqual(treeItems, previousTreeItemsRef.current)) {
    previousTreeItemsRef.current = treeItems;
    handleUpdateLayerTree('reactflow', treeItems, 'Base layer');
  }

  const [renderForm, setRenderForm] = useState<ReactNode | null>(null);
  const [showLayersPanel, setShowLayersPanel] = useState<boolean>(true);

  return (
    <LayerContextProvider
      value={{
        activeLayerId: activeLayer.layerId,
        activeLayerPayload: activeLayer.payload,
        activateLayer,
        treeCollection,
        onTreeOperation: handleTreeOperation,
        updateLayerTree: handleUpdateLayerTree,
      }}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        <div
          style={{
            flex: '0 0 ' + (showLayersPanel ? '240px' : '24px'),
            transition: 'flex 120ms ease',
            background: 'var(--c-blue-61)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: 6,
            overflow: 'hidden',
            zIndex: 20,
            display: 'flex',
          }}
        >
          <div style={{ flex: 1, display: showLayersPanel ? 'block' : 'none' }}>
            <LayersTreePanel viewId={viewId} />
          </div>
          <button
            title={showLayersPanel ? 'Collapse' : 'Expand'}
            onClick={() => setShowLayersPanel((v) => !v)}
            style={{
              width: 24,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderLeft: '1px solid var(--color-border, #e5e7eb)',
            }}
          >
            {showLayersPanel ? '<' : '>'}
          </button>
        </div>

        <div
          className={`holistix-space-whiteboard`}
          style={{
            flex: '1 1 auto',
            height: '100%',
            position: 'relative',
          }}
          ref={logics.pt.bindDiv.bind(logics.pt)}
          onMouseMove={logics.pt.onPaneMouseMove.bind(logics.pt)}
          onMouseLeave={logics.pt.setPointerInactive.bind(logics.pt)}
        >
          <ReactFlowBaseLayer
            viewId={viewId}
            nodeTypes={nodeTypes}
            pointerTracker={logics.pt}
            viewport={viewport}
            onContextMenu={handleContextualMenu}
            onContextMenuNewEdge={handleContextualMenuNewEdge}
            active={activeLayer.layerId === 'reactflow'}
          />

          {/* module defined layers - inactive by default */}
          {layersProviders?.map((provider) => (
            <div
              key={provider.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents:
                  activeLayer.layerId === provider.id ? 'auto' : 'none',
                zIndex: provider.zIndexHint ?? 1,
              }}
            >
              <provider.Component
                viewId={viewId}
                active={activeLayer.layerId === provider.id}
                viewport={viewport}
                payload={activeLayer.payload}
              />
            </div>
          ))}

          <AvatarsRenderer avatarsStore={logics.as} />

          {renderForm}
        </div>

        <ContextualMenu
          triggerRef={ContextualMenuTriggerRef}
          entries={() =>
            spaceMenuEntries({
              viewId,
              from,
              sharedData: sdm.getData(),
              position: () => rcc.current,
              renderForm: setRenderForm,
              renderPanel: openPanel,
              closePanel,
              dispatcher,
            })
          }
        />
      </div>
    </LayerContextProvider>
  );
};

/**
 * #########################################################
 * ReactFlowContent
 * @param param0
 * @returns
 */

const ReactFlowBaseLayer = ({
  viewId,
  nodeTypes,
  pointerTracker,
  viewport,
  onContextMenu,
  onContextMenuNewEdge,
  active,
}: {
  viewId: string;
  nodeTypes: TNodeTypes;
  pointerTracker: PointerTracker;
  viewport: LayerViewportAdapter;
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
  active: boolean;
}) => {
  //

  const dispatcher = useDispatcher<TEventEdgePropertyChange | TEventNewEdge>();

  const onDrop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data, position }: { data: any; position: TPosition }) => {
      dispatcher.dispatch({ ...data, origin: { position, viewId } });
    },
    [dispatcher, viewId]
  );

  const onConnect = useCallback(
    (edge: TEdge) => {
      dispatcher.dispatch({
        type: 'core:new-edge',
        edge,
      });
    },
    [dispatcher]
  );

  /**
   * Modes state
   */

  const [mode, setMode] = useState<WhiteboardMode>('default');

  // Toggle pan-only mode with Shift+Z
  useHotkeys(
    'shift+z',
    () => {
      active && setMode(mode === 'move-node' ? 'default' : 'move-node');
    },
    {
      preventDefault: true,
    }
  );

  /**
   * Edge menu logics
   */

  const [edgeMenu, _setEdgeMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);

  const setEdgeMenu = useCallback(
    ({ edgeId, x, y }: { edgeId: string; x: number; y: number }) => {
      _setEdgeMenu({ edgeId, x, y });
    },
    []
  );

  // Event sequence for edge renderProps change
  const { createEventSequence } = useEventSequence<
    TEventEdgePropertyChange,
    TSpaceSharedData
  >();
  const renderPropsChangeEventSequenceRef =
    useRef<FrontendEventSequence<TEventEdgePropertyChange> | null>(null);

  // Manage event sequence lifecycle based on edgeMenu
  const prevEdgeIdRef = useRef<string | null>(null);
  if (edgeMenu?.edgeId !== prevEdgeIdRef.current) {
    // Clean up previous sequence if edgeId changed or edgeMenu is null
    if (renderPropsChangeEventSequenceRef.current) {
      renderPropsChangeEventSequenceRef.current.cleanup();
      renderPropsChangeEventSequenceRef.current = null;
    }
    if (edgeMenu?.edgeId) {
      // Create new sequence for this edgeId
      renderPropsChangeEventSequenceRef.current = createEventSequence({
        localReduceUpdateKeys: ['graphViews'],
        localReduce: (sdc, event) => {
          const gv: TGraphView = sdc.graphViews.get(viewId);
          const e = gv.graph.edges.find((e) => edgeId(e) === event.edgeId);
          if (e) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e as any).renderProps = event.properties.renderProps;
          }
        },
      });
    }
    prevEdgeIdRef.current = edgeMenu?.edgeId ?? null;
  }

  const handleRenderPropsChange = useCallback(
    (rp: TEdgeRenderProps) => {
      if (edgeMenu && renderPropsChangeEventSequenceRef.current) {
        renderPropsChangeEventSequenceRef.current.dispatch({
          type: 'space:edge-property-change',
          edgeId: edgeMenu.edgeId,
          properties: { renderProps: rp },
        });
      }
    },
    [edgeMenu]
  );

  const resetEdgeMenu = useCallback(() => {
    _setEdgeMenu(null);
  }, []);

  /**
   * Space context
   */

  const sdm = useShareDataManager<TSpaceSharedData & TCoreSharedData>();

  const ss = useMemo(() => new CollabSpaceState(viewId, sdm), [viewId, sdm]);

  const context = useMemo(
    () => ({
      spaceState: ss,
      mode,
      viewId,
      edgeMenu,
      setEdgeMenu,
      resetEdgeMenu,
    }),
    [ss, mode, viewId, edgeMenu, setEdgeMenu, resetEdgeMenu]
  );

  const Node = useMemo(() => makeSpaceNode(nodeTypes), [nodeTypes]);

  //
  return (
    <ReactflowLayerContext value={context}>
      <ReactflowLayer
        active={active}
        viewId={viewId}
        nodeComponent={Node}
        edgeComponent={CustomStoryEdge}
        spaceState={ss}
        pointerTracker={pointerTracker}
        onContextMenu={onContextMenu}
        onContextMenuNewEdge={onContextMenuNewEdge}
        onConnect={onConnect}
        onDrop={onDrop}
        viewport={viewport}
      />
      {active && (
        <ModeIndicator
          mode={mode}
          onModeChange={setMode}
          onContextMenu={onContextMenu}
          getViewport={viewport.getViewport}
        />
      )}
      {edgeMenu && (
        <EdgeMenu
          eid={edgeMenu.edgeId}
          position={[edgeMenu.x, edgeMenu.y]}
          setRenderProps={handleRenderPropsChange}
        />
      )}
    </ReactflowLayerContext>
  );
};
