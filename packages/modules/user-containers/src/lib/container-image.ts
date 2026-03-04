export type TContainerImageDefinition = {
  imageId: string;
  imageName: string;
  imageUri: string;
  imageTag: string;
  imageSha256?: string;
  description?: string;
  category?: string;
  icon?: string;
};

// Simplified image info for frontend (stored in shared data)
export type TContainerImageInfo = {
  imageId: string;
  imageName: string;
  description?: string;
};
