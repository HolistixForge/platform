import { useEffect, useRef, useMemo } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import { useAwareness, bindEditor } from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/core';
import { useNodeContext } from '@monorepo/space';
import {
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';
import { makeUuid } from '@monorepo/simple-types';

import 'quill/dist/quill.snow.css';
import './text-editor.scss';

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

Quill.register('modules/cursors', QuillCursors);

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
  const editorId = useMemo(() => `editor-${makeUuid()}`, []);

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
    if (!hasLoadedQuillRef.current) {
      hasLoadedQuillRef.current = true;

      const quill = new Quill(`#${editorId}`, {
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
        bindEditor(awareness, 'quill', id, quill, 'Hello World !');
      }
    }
  }, [awareness, id, editorId]);

  return (
    <div className={`common-node node-quill full-height node-resizable`}>
      <NodeHeader
        nodeType="Text Editor"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />

      <DisableZoomDragPan fullHeight noDrag>
        <div
          className={`node-wrapper-body full-height ${
            selected ? 'node-background' : ''
          }`}
        >
          <div id={editorId}></div>
        </div>
      </DisableZoomDragPan>
    </div>
  );
};

//

export const NodeTextEditor = ({ node }: { node: TGraphNode }) => {
  const useNodeValue = useNodeContext();

  //

  return <NodeTextEditorInternal {...useNodeValue} />;
};
