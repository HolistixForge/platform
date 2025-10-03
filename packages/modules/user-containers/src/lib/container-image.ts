export type TContainerImageDefinition = {
  imageId: string; // Unique ID: "{module_name}:{image_name}"
  imageName: string;
  imageUri: string;
  imageTag: string;
  imageSha256?: string;
  userAvailable: boolean;
  options: TContainerImageOptions;

  // Metadata
  description?: string;
  category?: string;
  icon?: string;
};

export type TOAuthClient = {
  serviceName: string;
  accessTokenLifetime?: number;
  redirectUris?: string[];
};

export type TContainerImageOptions = {
  ports?: number[];
  oauthClients?: TOAuthClient[];

  // Type mapping (replaces hardcoded switch)
  containerType: string; // e.g., "jupyter", "pgadmin", "generic"

  // Runtime requirements
  capabilities?: string[]; // e.g., ["NET_ADMIN"]
  devices?: string[]; // e.g., ["/dev/net/tun"]

  // UI customization
  cardComponent?: string; // Custom React component for container card
};

// Simplified image info for frontend (stored in shared data)
export type TContainerImageInfo = {
  imageId: string;
  imageName: string;
  description?: string;
};
