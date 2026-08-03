import { TEdge } from './core-types';

// Answer with a local copy shaped exactly like LocalOverrider.getData():
// keyed by the full shared-data key, not by a bare 'edges'. The state lives on
// `global` because a jest.mock factory may not close over module scope.
jest.mock('@holistix-forge/collab/frontend', () => ({
  useLocalSharedData: (
    observe: string[],
    f: (data: Record<string, unknown>) => unknown
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = global as any;
    g.__observedKeys.push(observe);
    return f(g.__localSharedData);
  },
}));

const { useNodeEdges } = require('./core-hooks');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any;

const edge = (from: string, to: string): TEdge =>
  ({
    from: { node: from, connectorName: 'outputs' },
    to: { node: to, connectorName: 'inputs' },
  } as TEdge);

describe('useNodeEdges', () => {
  beforeEach(() => {
    g.__localSharedData = {};
    g.__observedKeys = [];
  });

  it('should observe the core-graph:edges key', () => {
    g.__localSharedData = { 'core-graph:edges': [] };

    useNodeEdges('a');

    expect(g.__observedKeys).toEqual([['core-graph:edges']]);
  });

  it('should read the edges from the namespaced key, not from sd.edges', () => {
    // Regression: the hook used to select the whole shared data and
    // destructure `edges` off it, a key the local copy never has. It returned
    // an empty array to every caller.
    g.__localSharedData = { 'core-graph:edges': [edge('anchor', 'chat')] };

    expect(useNodeEdges('chat')).toHaveLength(1);
  });

  it('should return the edges entering the node', () => {
    g.__localSharedData = {
      'core-graph:edges': [edge('anchor', 'chat'), edge('other', 'elsewhere')],
    };

    expect(useNodeEdges('chat')).toEqual([edge('anchor', 'chat')]);
  });

  it('should return the edges leaving the node', () => {
    g.__localSharedData = {
      'core-graph:edges': [edge('anchor', 'chat'), edge('other', 'elsewhere')],
    };

    expect(useNodeEdges('anchor')).toEqual([edge('anchor', 'chat')]);
  });

  it('should return an empty array for a node with no edge', () => {
    g.__localSharedData = { 'core-graph:edges': [edge('anchor', 'chat')] };

    expect(useNodeEdges('lonely')).toEqual([]);
  });

  it('should return an empty array when the key is not materialized yet', () => {
    g.__localSharedData = {};

    expect(useNodeEdges('chat')).toEqual([]);
  });
});
