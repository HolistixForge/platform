import { Awareness, YjsAwareness } from '../../index';

//

export type TEditor = any; // editor.IStandaloneCodeEditor;

//

export const bindEditor = async (
  awareness: Awareness,
  type: 'monaco' | 'quill',
  celluleId: string,
  editor: TEditor,
  code: string
) => {
  if ((awareness as YjsAwareness).getBindingObjects) {
    const { ytext, providerAwareness } = (
      awareness as YjsAwareness
    ).getBindingObjects(celluleId, code);

    if (type === 'monaco') {
      const { MonacoBinding } = await import('y-monaco');

      new MonacoBinding(
        ytext,
        editor.getModel() as any, // editor.ITextModel,
        new Set([editor]),
        providerAwareness
      );
    } else if (type === 'quill') {
      const { QuillBinding } = await import('y-quill');
      new QuillBinding(ytext, editor, providerAwareness);
    }
  }
};
