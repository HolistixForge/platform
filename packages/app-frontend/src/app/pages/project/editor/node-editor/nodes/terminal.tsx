import { useCallback } from 'react';

import { useNodeContext } from '@monorepo/space';
import { NodeTerminal, JupyterTerminal } from '@monorepo/jupyter';

import { useDispatcher } from '../../../model/collab-model-chunk';

//
//

export const TerminalNodeLogic = ({
  id,
  server_name,
  project_server_id,
}: {
  id: string;
  server_name: string;
  project_server_id: number;
}) => {
  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'core:delete-node',
      id,
    });
  }, [dispatcher, id]);

  return (
    <NodeTerminal
      {...useNodeValue}
      server_name={server_name}
      project_server_id={project_server_id}
      onDelete={handleDelete}
      Terminal={JupyterTerminal}
    />
  );
};
