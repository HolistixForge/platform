import { SharedMap } from '@holistix/collab-engine';
import {
  TContainerImageDefinition,
  TContainerImageInfo,
} from './container-image';

export class ContainerImageRegistry {
  private images: Map<string, TContainerImageDefinition> = new Map();
  private imagesSharedArray: SharedMap<TContainerImageInfo>;

  constructor(imagesSharedArray: SharedMap<TContainerImageInfo>) {
    this.imagesSharedArray = imagesSharedArray;
  }

  register(images: TContainerImageDefinition[]): void {
    images.forEach((img) => {
      if (this.images.has(img.imageId)) {
        throw new Error(`Image ${img.imageId} already registered`);
      }
      this.images.set(img.imageId, img);
      this.imagesSharedArray.set(img.imageId, {
        imageId: img.imageId,
        imageName: img.imageName,
        description: img.description,
      });
    });
  }

  get(imageId: string): TContainerImageDefinition | undefined {
    return this.images.get(imageId);
  }
}
