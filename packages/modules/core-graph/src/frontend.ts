// Frontend-only exports (React hooks)
export { useNodeEdges } from './lib/core-hooks';

// Re-export all backend-safe exports
export type { TModule } from '@holistix/module';
export type { TCollabBackendExports } from '@holistix/collab';
export type { TReducersBackendExports } from '@holistix/reducers';
export type { TCollabFrontendExports } from '@holistix/collab/frontend';

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


