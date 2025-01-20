/** what is store in Database */
export type TD_User = {
  /** uuid */
  user_id: string;
  /** Oauth provider user id */
  provider_id: string | null;
  type: 'github' | 'gitlab' | 'local';
  username: string;
  email: string;
  email_validated: boolean;
  signup_date: Date;
  picture: string | null;
  firstname: string | null;
  lastname: string | null;
};

//

export type CurrentUserDetails = Omit<TD_User, 'provider_id' | 'type'> & {
  user_type: 'local' | 'github' | 'gitlab';
  totp_enabled: boolean;
  totp_last: Date;
  password_reset: boolean;
};

/** what is returned by Ganyemde API */
export type TG_User = Pick<
  TD_User,
  'user_id' | 'username' | 'firstname' | 'lastname' | 'picture'
>;

/** what is used in frontend */
export type TF_User = TG_User & {
  color?: string;
  live?: boolean;
};

export type TCollaborator = TG_User & {
  scope: string[];
  is_owner: boolean;
};

