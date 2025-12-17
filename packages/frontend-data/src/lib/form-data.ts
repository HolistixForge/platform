export type LoginFormData = {
  email: string;
  password: string;
};

export type NewPasswordFormData = {
  password: string;
};

export type NewOrganizationFormData = {
  name: string;
};

export type NewProjectFormData = {
  organization_id: string;
  name: string;
  public: boolean;
};

export type SignupFormData = {
  email: string;
  password: string;
  username: string;
  firstname: string;
  lastname: string;
};

export type TotpEnableFormData = {
  enabled: boolean;
};

export type TotpLoginFormData = {
  code: string;
};
