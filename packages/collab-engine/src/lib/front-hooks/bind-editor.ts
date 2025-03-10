import { Awareness, YjsAwareness } from '../../index';

//

export const bindEditor = async (
  awareness: Awareness,
  type: 'monaco' | 'quill',
  celluleId: string,
  editor: any,
  code: string
) => {
  if ((awareness as YjsAwareness).getBindingObjects) {
    const { ytext, providerAwareness } = await (
      awareness as YjsAwareness
    ).getBindingObjects(celluleId, code);

    if (type === 'monaco') {
      const { MonacoBinding } = await import('y-monaco');

      new MonacoBinding(
        ytext!,
        editor.getModel() as any,
        new Set([editor]),
        providerAwareness
      );
    } else if (type === 'quill') {
      const { QuillBinding } = await import('y-quill');
      new QuillBinding(ytext!, editor, providerAwareness);
    }
  }
};
