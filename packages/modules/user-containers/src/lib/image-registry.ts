import { TContainerImageDefinition } from '@monorepo/module';

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

  list(filter?: {
    userAvailable?: boolean;
    category?: string;
  }): TContainerImageDefinition[] {
    let images = Array.from(this.images.values());

    if (filter?.userAvailable !== undefined) {
      images = images.filter(
        (img) => img.userAvailable === filter.userAvailable
      );
    }

    if (filter?.category) {
      images = images.filter((img) => img.category === filter.category);
    }

    return images.sort((a, b) => a.imageName.localeCompare(b.imageName));
  }

  // Helper methods
  getByContainerType(containerType: string): TContainerImageDefinition[] {
    return Array.from(this.images.values()).filter(
      (img) => img.options.containerType === containerType
    );
  }

  getAllContainerTypes(): string[] {
    const types = new Set<string>();
    this.images.forEach((img) => {
      types.add(img.options.containerType);
    });
    return Array.from(types);
  }
}
