import { CSSProperties, useCallback } from 'react';

import {
  NodeHeader,
  DisableZoomDragPan,
  useNodeContext,
  InputsAndOutputs,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { TGraphNode } from '@monorepo/core-graph';
import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';
import { TTabEvents } from '@monorepo/tabs';
import { TJsonObject } from '@monorepo/simple-types';

import { ServerCardInternal } from '../server-card';
import { TUserContainer } from '../../servers-types';
import { TUserContainersSharedData } from '../../servers-shared-model';
import { TUserContainersEvents } from '../../servers-events';
import { TContainerImageInfo } from '../../container-image';

//

export type UseContainerProps = {
  container: TUserContainer;
  image: TContainerImageInfo | undefined;
  onDelete: () => Promise<void>;
  onOpenService: (name: string) => void;
};

export const useContainerProps = (
  container_id: string
): UseContainerProps | undefined => {
  //

  const uc: TUserContainer = useLocalSharedData<TUserContainersSharedData>(
    ['user-containers:containers'],
    (sd) => sd['user-containers:containers'].get(`${container_id}`)
  );

  const containerImages: Map<string, TContainerImageInfo> =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:images'],
      (sd) => sd['user-containers:images']
    );

  const dispatcher = useDispatcher<
    TUserContainersEvents | TTabEvents<TJsonObject>
  >();

  const onDelete = useCallback(async () => {
    if (uc)
      await dispatcher.dispatch({
        type: 'user-container:delete',
        user_container_id: container_id,
      });
  }, [dispatcher, container_id, uc]);

  //

  const onOpenService = useCallback(
    async (name: string) => {
      if (uc) {
        const service = uc.httpServices.find((svc) => svc.name === name);
        if (service) {
          await dispatcher.dispatch({
            type: 'tabs:add-tab',
            path: [],
            title: `${uc.container_name}:${service.name}`,
            payload: {
              type: 'resource-ui',
              user_container_id: container_id,
              service_name: name,
            },
          });
        }
      }
    },
    [dispatcher, container_id, uc]
  );

  //
  if (uc)
    return {
      onDelete,
      onOpenService,
      container: uc,
      image: containerImages.get(`${uc.image_id}`),
    };

  return undefined;
};

//

export const NodeServer = ({
  node,
}: {
  node: TGraphNode<{ container_id: string }>;
}) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const container_id = node.data!.container_id as string;

  const useNodeValue = useNodeContext();

  const props = useContainerProps(container_id);

  if (props) return <NodeServerInternal {...useNodeValue} {...props} />;

  return null;
};

/**
 *
 */

export const NodeServerInternal = (props: UseContainerProps) => {
  //

  const { onDelete, ...otherProps } = props;

  const { id, isOpened, selected, open } = useNodeContext();

  const buttons = useNodeHeaderButtons({
    onDelete,
  });

  return (
    <div
      className={`common-node server-node`}
      style={{ '--node-wrapper-header-height': '78px' } as CSSProperties}
    >
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="server"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div className="node-wrapper-body server">
            <ServerCardInternal {...otherProps} onDelete={onDelete} />
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
