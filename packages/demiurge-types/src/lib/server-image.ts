/** what is store in Database */
export type TD_ServerImage = {
  image_id: number;
  image_name: string;
  image_uri: string;
  image_tag: string;
  image_sha256: string | null;
  options: TServerImageOptions;
  user_available: boolean;
};

export type TServerImageOptions = {
  ports?: number[];
  oauthClients?: {
    serviceName: string;
    /** secondes */
    accessTokenLifetime?: number;
  }[];
};

/** what is returned by Ganyemde API */
export type TG_ServerImage = Pick<
  TD_ServerImage,
  'image_id' | 'image_name' | 'image_tag' | 'image_sha256'
>;
