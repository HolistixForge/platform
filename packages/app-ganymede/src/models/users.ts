import crypto from 'crypto';
import { Req, UserSerializedInfo } from '../types';
import { myfetch } from '@monorepo/backend-engine';
import { EPriority, log } from '@monorepo/log';
import { pg } from '../database/pg';
import { CurrentUserDetails } from '@monorepo/demiurge-types';

//
//
//

const registerUser = async (u: {
  type: 'local' | 'github' | 'gitlab' | 'linkedin' | 'discord';
  username: string;
  email: string;
  picture: string | null;
  firstname: string | null;
  lastname: string | null;
  hash: string | null;
  salt: string | null;
  provider_id: string | null;
}): Promise<string> => {
  const r = await pg.query(
    'call proc_users_new($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      u.type,
      u.provider_id,
      u.username,
      u.email,
      u.picture,
      u.firstname,
      u.lastname,
      u.hash,
      u.salt,
      null,
      null,
    ]
  );
  const row = r.next()!.oneRow();
  const user_id = row['user_id'] as string;
  const organization_id = row['organization_id'] as string;

  log(
    EPriority.Info,
    'NEW_USER',
    `${user_id} (org: ${organization_id}): ${JSON.stringify(u)}`
  );

  return user_id;
};

//

export const getUserSessionDetails = async (
  id: string
): Promise<CurrentUserDetails | undefined> => {
  const r = await pg.query('select * from func_sessions_details($1)', [id]);
  const rs = r.next();
  if (!rs) return undefined;
  const row = rs.oneRow();
  return row as unknown as CurrentUserDetails;
};

//

export const verifyPassword = async (
  email: string,
  password: string
): Promise<UserSerializedInfo | false> => {
  const r = await pg.query('select * from func_users_get_hash($1)', [email]);
  const row = r.next()!.oneRow();
  if (!row) return false;

  const hash = await hashPassword(password, row['salt'] as string);

  if (
    !crypto.timingSafeEqual(
      Buffer.from(row['hash'] as string),
      Buffer.from(hash)
    )
  ) {
    return false;
  }

  return { id: row['user_id'] as string, username: row['username'] as string };
};

//

const userGetByProviderId = async (
  provider_id: string
): Promise<UserSerializedInfo | null> => {
  const r = await pg.query('select * from func_users_get_by_provider_id($1)', [
    provider_id,
  ]);
  const row = r.next()!.oneRow();
  if (row)
    return {
      id: row['user_id'] as string,
      username: row['username'] as string,
    };
  return null;
};

//

export const userGetLocalByEmail = async (
  email: string
): Promise<UserSerializedInfo | null> => {
  const r = await pg.query('select * from func_users_get_local_by_email($1)', [
    email,
  ]);
  const row = r.next()!.oneRow();
  if (row)
    return {
      id: row['user_id'] as string,
      username: row['username'] as string,
    };
  return null;
};

//

export type TGithubReturnedProfile = {
  id: string;
  username: string;
  _json: {
    avatar_url: string;
  };
};

export const githubFindOrCreate = async (
  githubProfile: TGithubReturnedProfile,
  token: string
): Promise<UserSerializedInfo> => {
  const provider_id = `github:${githubProfile.id}`;

  const u = await userGetByProviderId(provider_id);
  if (u) return u;

  const email = await myfetch({
    url: 'https://api.github.com/user/emails',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'demiurge.co',
    },
  }).then((r) => {
    const emails = r.json as { primary: boolean; email: string }[];
    const primaryEmail = emails.find((email) => email.primary);
    return primaryEmail ? primaryEmail.email : 'unknown';
  });

  const username = `github:${githubProfile.username}`;

  const user_id = await registerUser({
    type: 'github',
    provider_id,
    username,
    picture: githubProfile._json.avatar_url,
    email,
    firstname: null,
    lastname: null,
    hash: null,
    salt: null,
  });

  return { id: user_id, username };
};

//

export type TGitlabReturnedProfile = {
  id: string;
  username: string;
  _json: {
    avatar_url: string;
    email: string;
  };
};

export const gitlabFindOrCreate = async (
  gitlabProfile: TGitlabReturnedProfile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  token: string
): Promise<UserSerializedInfo> => {
  const provider_id = `gitlab:${gitlabProfile.id}`;

  const u = await userGetByProviderId(provider_id);
  if (u) return u;

  const username = `gitlab:${gitlabProfile.username}`;

  const user_id = await registerUser({
    type: 'gitlab',
    provider_id,
    username,
    picture: gitlabProfile._json.avatar_url,
    email: gitlabProfile._json.email,
    firstname: null,
    lastname: null,
    hash: null,
    salt: null,
  });

  return { id: user_id, username };
};

//

export type TLinkedinReturnedProfile = {
  id: string;
  displayName: string;
  givenName: string;
  familyName: string;
  email: string;
  picture: string;
};

export const linkedinFindOrCreate = async (
  linkedinProfile: TLinkedinReturnedProfile,
  token: string
): Promise<UserSerializedInfo> => {
  const provider_id = `linkedin:${linkedinProfile.id}`;
  const u = await userGetByProviderId(provider_id);
  if (u) return u;

  const email = linkedinProfile.email || 'unknown';
  const username = `linkedin:${
    linkedinProfile.displayName || linkedinProfile.id
  }`;
  const picture = linkedinProfile.picture || null;

  const user_id = await registerUser({
    type: 'linkedin',
    provider_id,
    username,
    picture,
    email,
    firstname: null,
    lastname: null,
    hash: null,
    salt: null,
  });

  return { id: user_id, username };
};

//

export type TDiscordReturnedProfile = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
};

export const discordFindOrCreate = async (
  discordProfile: TDiscordReturnedProfile,
  token: string
): Promise<UserSerializedInfo> => {
  const provider_id = `discord:${discordProfile.id}`;
  const u = await userGetByProviderId(provider_id);
  if (u) return u;

  const email = discordProfile.email || 'unknown';
  const username = `discord:${discordProfile.username}#${discordProfile.discriminator}`;
  const picture = discordProfile.avatar
    ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
    : null;

  const user_id = await registerUser({
    type: 'discord',
    provider_id,
    username,
    picture,
    email,
    firstname: null,
    lastname: null,
    hash: null,
    salt: null,
  });

  return { id: user_id, username };
};

//

/**
 * return a 64 Bytes hash as a 128 caracters hexadecimal string.
 * @param password
 * @param salt
 * @returns
 */
const hashPassword = (password: string, salt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const iterations = 100000; // Number of iterations
    const keylen = 64; // Output key length
    const digest = 'sha512'; // Hashing algorithm

    crypto.pbkdf2(
      password,
      salt,
      iterations,
      keylen,
      digest,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex'));
      }
    );
  });
};

//

/**
 * a 128 bytes salt as a 256 hex caracters string.
 * @returns string
 */
export const salt = () => crypto.randomBytes(128).toString('hex');

export const signup = async (userInfo: {
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  password: string;
}): Promise<string> => {
  const pSalt = salt();
  const hash = await hashPassword(userInfo.password, pSalt);

  try {
    const user_id = await registerUser({
      type: 'local',
      provider_id: null,
      username: `local:${userInfo.username}`,
      picture: null,
      email: userInfo.email,
      firstname: userInfo.firstname || null,
      lastname: userInfo.lastname || null,
      hash,
      salt: pSalt,
    });
    return user_id;
  } catch (error: any) {
    const emailExists = error.message.includes('unique_email');
    if (emailExists) throw new Error('an account exists for this email yet');

    const usernameUsed = error.message.includes('unique_username');
    if (usernameUsed) throw new Error('this username is used yet');

    throw error;
  }
};

//

export const findKeyForUserId = async (
  id: string
): Promise<{ key: string; validated: boolean } | undefined> => {
  const r = await pg.query('select * from func_totp_get_key($1)', [id]);
  const row = r.next()!.oneRow();
  if (row)
    return {
      key: row['key'] as string,
      validated: row['validated'] as boolean,
    };
  return undefined;
};

//

export const setEmailValidated = async (id: string): Promise<void> => {
  await pg.query('call proc_users_set_email_validated($1)', [id]);
};

//

export const totpSuccess = async (
  session_id: string,
  user_id: string
): Promise<void> => {
  await pg.query('call proc_totp_success($1, $2)', [session_id, user_id]);
};

//

export const totpSaveKey = async (id: string, key: string): Promise<void> => {
  await pg.query('call proc_totp_set_key($1, $2)', [id, key]);
  log(EPriority.Info, 'TOTP', `new key for user [${id}]`);
};

//

export const passwordFlagReset = async (user_id: string) => {
  await pg.query('call proc_passwords_flag_reset($1)', [user_id]);
  log(EPriority.Info, 'PASSWORD', `reset flag for user [${user_id}]`);
};

//

export const passwordChange = async (user_id: string, password: string) => {
  const pSalt = salt();
  const hash = await hashPassword(password, pSalt);
  await pg.query('call proc_password_change($1, $2, $3)', [
    user_id,
    hash,
    pSalt,
  ]);
};

//

export const userIsAuthenticated = async (req: Req) => {
  let r = false;
  const d = await getUserSessionDetails(req.sessionID);
  if (!d || !d.user_id) r = false;
  /*
  TODO_EMAIL_VALIDATION: uncomment to enforce email validation before access to UI
  else if (d.user_type === 'local' && !d.email_validated) r = false;
  */ else if (userNeedTotpAuthentication(d)) r = false;
  else r = true;
  log(
    EPriority.Info,
    'USER_MODEL',
    r ? `user is authenticated [${d!.user_id}]` : 'user is not authenticated'
  );
  return r;
};

//

export const userNeedTotpAuthentication = (
  user: CurrentUserDetails,
  expiredDelay?: number
) => {
  if (user.totp_enabled) {
    if (!user.totp_last) return true;
    else if (expiredDelay && isOlderThan(user.totp_last, expiredDelay))
      return true;
  }

  return false;
};

//

function isOlderThan(dateToCheck: Date, minutes: number): boolean {
  const currentTime = new Date();
  const timeDifference = currentTime.getTime() - dateToCheck.getTime();
  const minutesDifference = timeDifference / (1000 * 60);
  return minutesDifference > minutes;
}
