import { useEffect, useRef } from 'react';

import { TGraphNode } from '@monorepo/core';
import { useNodeContext } from '@monorepo/space';
import {
  DisablePanSelect,
  TNodeContext,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';

import './text-editor.scss';

//

let quillScript: any = undefined;

//

export type NodeTextEditorInternalProps = {} & TNodeContext;

//
export const NodeTextEditorInternal = ({
  viewStatus,
  expand,
  reduce,
  isOpened,
  id,
  selected,
}: NodeTextEditorInternalProps) => {
  //

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const hasLoadedQuillRef = useRef(false);

  useEffect(() => {
    if (!quillScript) {
      quillScript = document.createElement('script');
      quillScript.src =
        'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
      document.body.appendChild(quillScript);

      const link = document.createElement('link');
      link.href =
        'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
      link.rel = 'stylesheet';
      if (!document.querySelector(`link[href="${link.href}"]`)) {
        document.head.appendChild(link);
      }
    }

    if (!hasLoadedQuillRef.current) {
      hasLoadedQuillRef.current = true;
      quillScript.onload = () => {
        new (window as any).Quill('#editor', {
          theme: 'snow',
          placeholder: 'Compose an epic...',
        });
      };
    }
  }, []);

  return (
    <div className={`common-node node-quill`}>
      <div
        className="opacity-on-hover"
        style={{ opacity: selected ? 1 : undefined }}
      >
        <NodeHeader
          nodeType="Text Editor"
          id={id}
          isOpened={isOpened}
          open={open}
          buttons={buttons}
        />
      </div>

      <DisablePanSelect>
        <div
          className={`node-wrapper-body node-wrapper-quill ${
            selected ? 'node-background' : ''
          }`}
        >
          <div id="editor" style={{ width: '400px' }}></div>
        </div>
      </DisablePanSelect>
    </div>
  );
};

//

export const NodeTextEditor = ({ node }: { node: TGraphNode }) => {
  const useNodeValue = useNodeContext();

  //

  return <NodeTextEditorInternal {...useNodeValue} />;
};
