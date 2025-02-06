export type TApi_Project = {
  project_id: string;
  owner_id: string;
  created: string;
  name: string;
  gateway_hostname: string | null;
};

export type TApi_Authorization = {
  user_id: string;
  is_owner: boolean;
  scope: string[];
};
