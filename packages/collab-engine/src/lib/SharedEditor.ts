export type BindingData = { type: string };

export abstract class SharedEditor {
  abstract createEditor(editorId: string, code: string): Promise<void>;
  abstract deleteEditor(editorId: string): Promise<void>;

  abstract getBindingObjects(editorId: string): Promise<BindingData | false>;
}

export class NoneSharedEditor extends SharedEditor {
  override createEditor(editorId: string, code: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  override async getBindingObjects(
    editorId: string
  ): Promise<BindingData | false> {
    return false;
  }
  override async deleteEditor(editorId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
