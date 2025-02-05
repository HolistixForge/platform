import {
  TDemiurgeNotebookEvent,
  TDemiurgeNotebookSharedData,
  TEdge,
  TServerEvents,
} from '@monorepo/demiurge-types';

export const edgeToEvent = (
  edge: TEdge,
  nodeData: TDemiurgeNotebookSharedData['nodeData'],
): Partial<TServerEvents> => {
  const n1 = nodeData.get(edge.from.node);
  const n2 = nodeData.get(edge.to.node);

  if (!n1 || !n2 || Object.is(n1, n2)) throw new Error(`impossible edge`);

  switch (n1?.type) {
    case 'volume':
      if (n2.type === 'server')
        return {
          type: 'mount-volume',
          project_server_id: n2.project_server_id,
          volume_id: n1.volume_id,
        };
      break;

    default:
      break;
  }
  throw new Error(
    `an edge can't be drawn between these nodes. from [${n1.type}] to [${n2.type}]`,
  );
};
