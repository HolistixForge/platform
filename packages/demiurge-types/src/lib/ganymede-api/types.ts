export type TApi_Project = {
  project_id: string;
  owner_id: string;
  created: string;
  name: string;
  gateway_hostname: string | null;
};

export type TApi_Volume = {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
};

export type TApi_Mount = {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
  mount_point: string;
};

export type TApi_Authorization = {
  user_id: string;
  is_owner: boolean;
  scope: string[];
};
