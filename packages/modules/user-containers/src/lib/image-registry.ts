import { SharedMap } from '@holistix-forge/collab-engine';
import {
  TContainerImageDefinition,
  TContainerImageInfo,
} from './container-image';

export class ContainerImageRegistry {
  private images: Map<string, TContainerImageDefinition> = new Map();
  private imagesSharedArray: SharedMap<TContainerImageInfo> | null;

  constructor(imagesSharedArray: SharedMap<TContainerImageInfo> | null) {
    this.imagesSharedArray = imagesSharedArray;
  }

  register(images: TContainerImageDefinition[]): void {
    images.forEach((img) => {
      if (this.images.has(img.imageId)) {
        throw new Error(`Image ${img.imageId} already registered`);
      }
      this.images.set(img.imageId, img);
      // In multi-project mode, shared array is managed per-project, not at module load
      if (this.imagesSharedArray) {
        this.imagesSharedArray.set(img.imageId, {
          imageId: img.imageId,
          imageName: img.imageName,
          description: img.description,
        });
      }
    });
  }

  get(imageId: string): TContainerImageDefinition | undefined {
    return this.images.get(imageId);
  }
}
