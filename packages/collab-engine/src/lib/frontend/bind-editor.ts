import { Awareness } from '../Awareness';
import { SharedEditor } from '../SharedEditor';
import { YjsAwareness } from '../yjs/YjsAwareness';
import { YjsBindingData } from '../yjs/YjsSharedEditor';

//

export const bindEditor = async (
  awareness: Awareness,
  sharedEditor: SharedEditor,
  editorType: string,
  editorId: string,
  editorObject: any
) => {
  const bindingObject = await sharedEditor.getBindingObjects(editorId);
  if (bindingObject) {
    //
    if (editorType === 'monaco' && bindingObject.type === 'yjs') {
      const { MonacoBinding } = await import('y-monaco');
      new MonacoBinding(
        (bindingObject as YjsBindingData).ytext,
        editorObject.getModel() as any,
        new Set([editorObject]),
        (awareness as YjsAwareness)._awareness
      );
    }
    //
    else if (editorType === 'quill' && bindingObject.type === 'yjs') {
      const { QuillBinding } = await import('y-quill');
      new QuillBinding(
        (bindingObject as YjsBindingData).ytext,
        editorObject,
        (awareness as YjsAwareness)._awareness
      );
    }
  }
};
