import { ReactNode } from 'react';

import { useJLsManager } from '../jupyter-shared-model';
import CodeEditorMonaco from '../components/code-editor-monaco/code-editor-monaco';

//

export const JupyterCollaborationProbes = ({
  children,
}: {
  children?: ReactNode;
}) => {
  const { jlsManager } = useJLsManager();

  const project_server_id = jlsManager._collaborationProbes.keys().next().value;
  const notebook = 'Untitled.ipynb';
  const cellule = 0;

  // console.log({ project_server_id, notebook, cellule });

  if (project_server_id)
    return (
      <>
        <div style={{ width: '100%', height: '500px' }}>
          <CodeEditorMonaco
            code={''}
            onMount={(editor) => {
              jlsManager.bindCellule(
                project_server_id,
                notebook,
                cellule,
                editor
              );
            }}
          />
        </div>
        {children}
      </>
    );
  return null;
};
