import { FC } from 'react';

/**
 * Viewport used by layer providers. Matches the host space coordinate system
 * (absoluteX/absoluteY in space units, plus zoom factor).
 */
export type LayerViewport = {
  absoluteX: number;
  absoluteY: number;
  zoom: number;
};

/**
 * Adapter given by the host to synchronize viewports across layers.
 * - call onViewportChange to emit local changes to the host
 * - call registerViewportChangeCallback to react to host changes
 * - optionally call setViewport for immediate programmatic updates
 */
export type LayerViewportAdapter = {
  /** Emit a new viewport when this layer changes it (pan/zoom). */
  onViewportChange: (viewport: LayerViewport) => void;
  /** Subscribe to host-driven viewport updates. */
  registerViewportChangeCallback: (
    callback: (viewport: LayerViewport) => void
  ) => void;
  /** Optional getter for initial or current viewport snapshot. */
  getViewport: () => LayerViewport;
};

/**
 * Props passed by the host to a layer component.
 */
export type LayerComponentProps = {
  /** Unique view identifier of the current whiteboard. */
  viewId: string;
  /** Whether this layer is currently interactive (receives pointer events). */
  active: boolean;
  /** Adapter for cross-layer viewport synchronization. */
  viewport: LayerViewportAdapter;
  /** Optional: payload data passed when layer is activated. */
  payload?: any;
};

/**
 * A provider that contributes a main whiteboard layer (canvas) to the host.
 * Implementations are rendered absolutely within the whiteboard container.
 */
export type TLayerProvider = {
  /** Stable identifier. */
  id: string;
  /** Human-friendly title for UI (layers panel). */
  title: string;
  /** Ordering hint relative to base whiteboard; higher renders above. */
  zIndexHint?: number;
  /** Factory for the layer component. */
  Component: FC<LayerComponentProps>;
  /** Optional: called by host when layer becomes active/inactive. */
  onActivate?: (viewId: string) => void;
  onDeactivate?: (viewId: string) => void;
};
