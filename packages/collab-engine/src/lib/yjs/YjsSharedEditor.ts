import { Map, Text } from 'yjs';

import { SharedEditor, BindingData } from '../SharedEditor';

//

export const EDITORS_YTEXT_YMAP_KEY = 'editors';

export type YjsBindingData = BindingData & {
  type: 'yjs';
  ytext: Text;
};

//

export class YjsSharedEditor extends SharedEditor {
  _editorBindings: Map<Text>;

  constructor(editorBindings: Map<Text>) {
    super();
    this._editorBindings = editorBindings;
  }

  override async getBindingObjects(
    editorId: string
  ): Promise<YjsBindingData | false> {
    let ytext = this._editorBindings.get(editorId);
    if (!ytext) {
      return false;
    }
    return { type: 'yjs', ytext };
  }

  async createEditor(editorId: string, code: string): Promise<void> {
    let ytext = this._editorBindings.get(editorId);

    if (!ytext) {
      ytext = new Text(code);
      this._editorBindings.set(editorId, ytext);
    }
  }

  async deleteEditor(editorId: string): Promise<void> {
    this._editorBindings.delete(editorId);
  }
}
