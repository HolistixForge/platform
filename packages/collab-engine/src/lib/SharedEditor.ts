export type BindingData = { type: string };

//

export abstract class SharedEditor {
  abstract createEditor(editorId: string, code: string): Promise<void>;

  abstract deleteEditor(editorId: string): Promise<void>;

  abstract getBindingObjects(editorId: string): Promise<BindingData | false>;
}

//

export class NoneSharedEditor extends SharedEditor {
  override createEditor(editorId: string, code: string): Promise<void> {
    return Promise.resolve();
  }

  override async getBindingObjects(
    editorId: string
  ): Promise<BindingData | false> {
    return false;
  }

  override async deleteEditor(editorId: string): Promise<void> {
    return Promise.resolve();
  }
}
