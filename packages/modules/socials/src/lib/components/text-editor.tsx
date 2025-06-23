import { useEffect, useRef, useMemo, useCallback } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import {
  useAwareness,
  useBindEditor,
  useDispatcher,
} from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/core';
import {
  useNodeContext,
  DisableZoomDragPan,
  TNodeContext,
  NodeHeader,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { makeUuid } from '@monorepo/simple-types';

import { TEventSocials } from '../socials-events';

import 'quill/dist/quill.snow.css';
import './text-editor.scss';

//
/*
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
*/
//

Quill.register('modules/cursors', QuillCursors);

//

export type NodeTextEditorInternalProps = {
  onDelete: () => Promise<void>;
} & Pick<TNodeContext, 'id' | 'isOpened' | 'open' | 'selected'>;

//

export const NodeTextEditorInternal = ({
  isOpened,
  id,
  selected,
  onDelete,
}: NodeTextEditorInternalProps) => {
  const { awareness } = useAwareness();
  const quillInstanceRef = useRef<any>(null);
  const hasLoadedQuillRef = useRef(false);
  const editorId = useMemo(() => `editor-${makeUuid()}`, []);

  //

  const toolbarDiv = useMemo(() => {
    const d = document.createElement('div');
    d.innerHTML = `<span class="ql-formats">
          <select class="ql-font"></select>
          <select class="ql-header">
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
            <option value="5">Heading 5</option>
            <option value="6">Heading 6</option>
            <option value="">Normal</option>
          </select>
        </span>
        <span class="ql-formats">
          <button class="ql-bold"></button>
          <button class="ql-italic"></button>
          <button class="ql-underline"></button>
          <button class="ql-strike"></button>
        </span>
        <span class="ql-formats">
          <select class="ql-color"></select>
          <select class="ql-background"></select>
        </span>
        <span class="ql-formats">
          <button class="ql-list" value="ordered"></button>
          <button class="ql-list" value="bullet"></button>
          <select class="ql-align"></select>
        </span>
        <span class="ql-formats">
          <button class="ql-link"></button>
          <button class="ql-image"></button>
          <button class="ql-video"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-clean"></button>
        </span>`;
    d.setAttribute('class', 'quill-toolbar');
    return d;
  }, []);

  //

  const buttons = useNodeHeaderButtons({
    onDelete,
  });

  const bindEditor = useBindEditor();

  //

  useEffect(() => {
    if (!hasLoadedQuillRef.current) {
      hasLoadedQuillRef.current = true;

      const quill = new Quill(`#${editorId}`, {
        theme: 'snow',
        placeholder: 'Compose an epic story here...',
        modules: {
          cursors: true,
          toolbar: {
            container: toolbarDiv, // `#${toolbarId}`,
            handlers: {
              // Add any custom handlers here if needed
            },
          },
          history: {
            userOnly: true,
          },
        },
      });

      quillInstanceRef.current = quill;

      if (awareness) {
        bindEditor('quill', id, quill);
      }
    }
  }, [awareness, id, editorId]);

  //

  const bindToolbar = useCallback((el: HTMLDivElement) => {
    if (el) {
      el.appendChild(toolbarDiv);
    }
  }, []);

  //

  return (
    <div className={`common-node node-quill full-height node-resizable`}>
      <NodeHeader
        nodeType="Text Editor"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      >
        <div ref={bindToolbar}></div>
      </NodeHeader>

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

  const dispatcher = useDispatcher<TEventSocials>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'socials:delete-text-editor',
      nodeId: node.id,
    });
  }, [dispatcher, node.id]);

  //
  return <NodeTextEditorInternal {...useNodeValue} onDelete={handleDelete} />;
};
