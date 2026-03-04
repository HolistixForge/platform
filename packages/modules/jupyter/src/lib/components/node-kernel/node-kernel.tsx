import { useCallback } from 'react';

import {
  InputsAndOutputs,
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/whiteboard/frontend';
import { TGraphNode } from '@holistix-forge/core-graph';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  TUserContainersSharedData,
  TUserContainer,
} from '@holistix-forge/user-containers';
import { Datetime } from '@holistix-forge/ui-base';

import { KernelStateIndicator } from './kernel-state-indicator';
import {
  TJupyterServerData,
  TKernelNodeDataPayload,
} from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-hooks';
import { TJupyterEvent } from '../../jupyter-events';

//

export const NodeKernel = ({
  node,
}: {
  node: TGraphNode<TKernelNodeDataPayload>;
}) => {
  //

  const { id, isOpened, open, selected } = useNodeContext();

  const { kernel_id, user_container_id } = node.data!;

  const kernelPack = useKernelPack(user_container_id, kernel_id);

  const s: { ps: TUserContainer; js: TJupyterServerData } = useLocalSharedData<
    TUserContainersSharedData & TJupyterSharedData
  >(['jupyter:servers', 'user-containers:containers'], (sd) => {
    return {
      js: sd['jupyter:servers'].get(`${user_container_id}`),
      ps: sd['user-containers:containers'].get(`${user_container_id}`),
    };
  });

  const kernel = s.js?.kernels[kernel_id];

  const client_id = s.ps?.auth_guard?.client_id;

  // console.log({ kernelPack, js: s.js, ps: s.ps, kernel, client_id });

  const dispatcher = useDispatcher<TJupyterEvent>();

  const handleDeleteKernel = useCallback(async () => {
    if (client_id) {
      await dispatcher.dispatch({
        type: 'jupyter:delete-kernel-node',
        nodeId: id,
      });
    }
  }, [dispatcher, kernel_id, client_id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeleteKernel,
  });

  //

  if (!kernelPack || !kernel) return <>Not Found</>;

  return (
    <div className={`common-node kernel-node`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="kernel"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div className="node-wrapper-body">
            <div
              className="node-background flex flex-col"
              style={{ borderRadius: '8px', padding: '20px', width: '400px' }}
            >
              <div>
                <p>
                  kernel <b>{kernel?.kernel_id.substring(0, 8)}</b>{' '}
                  {kernel?.name}
                </p>
                <KernelStateIndicator state={kernelPack.state} />
                <p>{kernel?.execution_state}</p>
                <p>
                  Last activity:&nbsp;
                  {kernel.last_activity ? (
                    <Datetime
                      value={kernel.last_activity}
                      formats={['ago']}
                      hoverFormats={['long']}
                    />
                  ) : (
                    'unknown'
                  )}
                </p>
                {kernel.notebooks && kernel.notebooks.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p className="font-medium" style={{ marginBottom: '8px' }}>
                      Connected Notebooks:
                    </p>
                    <ul
                      style={{
                        listStyleType: 'disc',
                        paddingLeft: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {kernel.notebooks.map((notebook: any) => (
                        <li
                          key={notebook.path}
                          style={{ fontSize: 'var(--font-size-sm)' }}
                        >
                          {notebook.name}
                          <span
                            style={{
                              color: 'var(--neutral-5)',
                              fontSize: 'var(--font-size-xs)',
                              marginLeft: '8px',
                            }}
                          >
                            ({notebook.path})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
