import { TUserContainersEvents } from '@holistix-forge/user-containers';
import { TCoreSharedData, TEdge } from '@holistix-forge/core-graph';

export const edgeToEvent = (
  edge: TEdge,
  nodes: TCoreSharedData['core-graph:nodes']
): Partial<TUserContainersEvents> => {
  const n1 = nodes.get(edge.from.node);
  const n2 = nodes.get(edge.to.node);

  if (!n1 || !n2 || Object.is(n1, n2)) throw new Error(`impossible edge`);

  switch (n1?.type) {
    case 'user-container':
      if (n2.type === 'user-container')
        return {
          type: 'user-container:new',
          project_id: '',
          containerName: n2.name,
          imageId: '',
        };
      break;

    default:
      break;
  }
  throw new Error(
    `an edge can't be drawn between these nodes. from [${n1.type}] to [${n2.type}]`
  );
};
