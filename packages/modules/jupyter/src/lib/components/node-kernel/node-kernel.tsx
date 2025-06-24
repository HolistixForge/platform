import { useCallback } from 'react';

import {
  InputsAndOutputs,
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { TGraphNode } from '@monorepo/module';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServersSharedData, TServer } from '@monorepo/servers';
import { Datetime } from '@monorepo/ui-base';

import { KernelStateIndicator } from './kernel-state-indicator';
import {
  TJupyterServerData,
  TKernelNodeDataPayload,
} from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-shared-model-front';
import { TJupyterEvent } from '../../jupyter-events';

//

export const NodeKernel = ({
  node,
}: {
  node: TGraphNode<TKernelNodeDataPayload>;
}) => {
  //

  const { id, isOpened, open, selected } = useNodeContext();

  const { kernel_id, project_server_id } = node.data!;

  const kernelPack = useKernelPack(project_server_id, kernel_id);

  const s: { ps: TServer; js: TJupyterServerData } = useSharedData<
    TServersSharedData & TJupyterSharedData
  >(['jupyterServers', 'projectServers'], (sd) => {
    return {
      js: sd.jupyterServers.get(`${project_server_id}`),
      ps: sd.projectServers.get(`${project_server_id}`),
    };
  });

  const kernel = s.js?.kernels[kernel_id];

  const client_id = s.ps?.oauth.find(
    (o) => o.service_name === 'jupyterlab'
  )?.client_id;

  // console.log({ kernelPack, js: s.js, ps: s.ps, kernel, client_id });

  const dispatcher = useDispatcher<TJupyterEvent>();

  const handleDeleteKernel = useCallback(async () => {
    client_id &&
      (await dispatcher.dispatch({
        type: 'jupyter:delete-kernel-node',
        nodeId: id,
      }));
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
            <div className="node-background rounded-[8px] col-span-1 flex flex-col p-5 w-[400px]">
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
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Connected Notebooks:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {kernel.notebooks.map((notebook: any) => (
                        <li key={notebook.path} className="text-sm">
                          {notebook.name}
                          <span className="text-gray-500 text-xs ml-2">
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
