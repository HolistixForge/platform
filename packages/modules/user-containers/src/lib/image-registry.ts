import { TContainerImageDefinition } from './container-image';

export class ContainerImageRegistry {
  private images: Map<string, TContainerImageDefinition> = new Map();

  register(images: TContainerImageDefinition[]): void {
    images.forEach((img) => {
      if (this.images.has(img.imageId)) {
        throw new Error(`Image ${img.imageId} already registered`);
      }
      this.images.set(img.imageId, img);
    });
  }

  get(imageId: string): TContainerImageDefinition | undefined {
    return this.images.get(imageId);
  }

  getAll(): TContainerImageDefinition[] {
    return Array.from(this.images.values());
  }
}
