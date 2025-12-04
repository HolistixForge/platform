// Frontend-only exports (React hooks)
export { useNodeEdges } from './lib/core-hooks';

// Re-export all backend-safe exports
export type { TModule } from '@holistix-forge/module';
export type { TCollabBackendExports } from '@holistix-forge/collab';
export type { TReducersBackendExports } from '@holistix-forge/reducers';
export type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

export { moduleBackend, moduleFrontend } from './index';

export type {
  TPosition,
  TEdge,
  TEdgeEnd,
  EEdgeSemanticType,
  TGraphNode,
  TConnector,
  TPin,
} from './lib/core-types';

export type { TCoreSharedData } from './lib/core-types';

export type {
  TEventDeleteEdge,
  TEventDeleteNode,
  TEventNewEdge,
  TEventNewNode,
  TEventOrigin,
  TCoreEvent,
} from './lib/core-events';


