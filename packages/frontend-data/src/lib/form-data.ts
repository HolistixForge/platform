export type LoginFormData = {
  email: string;
  password: string;
};

export type NewPasswordFormData = {
  password: string;
};

export type NewProjectFormData = { name: string; public: boolean };

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
