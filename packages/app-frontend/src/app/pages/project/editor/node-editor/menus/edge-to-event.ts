import { TUserContainersEvents } from '@holistix-forge/user-containers';
import { TCoreSharedData, TEdge } from '@holistix-forge/core-graph';

export const edgeToEvent = (
  edge: TEdge,
  nodes: TCoreSharedData['nodes']
): Partial<TUserContainersEvents> => {
  const n1 = nodes.get(edge.from.node);
  const n2 = nodes.get(edge.to.node);

  if (!n1 || !n2 || Object.is(n1, n2)) throw new Error(`impossible edge`);

  switch (n1?.type) {
    case 'volume':
      if (n2.type === 'user-container')
        return {
          type: 'user-containers:mount-volume',
          project_user_container_id: n2.data!
            .project_user_container_id as number,
          volume_id: n1.data!.volume_id as number,
        };
      break;

    default:
      break;
  }
  throw new Error(
    `an edge can't be drawn between these nodes. from [${n1.type}] to [${n2.type}]`
  );
};
