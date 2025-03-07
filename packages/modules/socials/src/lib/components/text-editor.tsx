import { useEffect, useRef } from 'react';
import QuillCursors from 'quill-cursors';

import { useAwareness, bindEditor } from '@monorepo/collab-engine';
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

const toolbarOptions = [
  ['bold', 'italic', 'underline', 'strike'], // toggled buttons
  ['blockquote', 'code-block'],
  ['link', 'image', 'video', 'formula'],

  [{ header: 1 }, { header: 2 }], // custom button values
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
  [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
  [{ direction: 'rtl' }], // text direction

  [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
  [{ header: [1, 2, 3, 4, 5, 6, false] }],

  [{ color: [] }, { background: [] }], // dropdown with defaults from theme
  [{ font: [] }],
  [{ align: [] }],

  ['clean'], // remove formatting button
];

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
  const { awareness } = useAwareness();
  const quillInstanceRef = useRef<any>(null);
  const hasLoadedQuillRef = useRef(false);

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

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
        const Quill = (window as any).Quill;
        Quill.register('modules/cursors', QuillCursors);

        const quill = new Quill('#editor', {
          theme: 'snow',
          placeholder: '<h2>Compose an epic...</h2>',
          modules: {
            cursors: true,
            toolbar: toolbarOptions,
            history: {
              userOnly: true,
            },
          },
        });

        quillInstanceRef.current = quill;

        if (awareness) {
          bindEditor(awareness, 'quill', id, quill, 'Hello World!');
        }

        quill.setContents({
          ops: [
            { insert: 'Hello World!' },
            { attributes: { header: 1 }, insert: '\n' },
            { insert: '\nCompose a beautiful Documentation...\n' },
          ],
        });
      };
    }
  }, [awareness, id]);

  return (
    <div className={`common-node node-quill`}>
      <NodeHeader
        nodeType="Text Editor"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />

      <DisablePanSelect>
        <div
          className={`node-wrapper-body ${selected ? 'node-background' : ''}`}
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
