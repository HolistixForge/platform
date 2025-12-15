import { SessionData, Store } from 'express-session';
import { TJson, TJsonObject } from '@holistix-forge/simple-types';
import { SESSION_MAX_AGE } from '../app';
import { EPriority, log } from '@holistix-forge/log';
import { pg } from '../database/pg';

type MySessionData = SessionData & { passport?: TJsonObject };

const SS = 'SESSION_MODEL';

const debug = (sid: string, session: TJsonObject | null, msg: string) => {
  const p: any = session?.['passport'];
  const username = p?.['user']?.['username'];
  log(
    EPriority.Debug,
    SS,
    `[${sid}] ${username ? `[${username}]` : ''} ${msg}`
  );
};

//
//

export class PgSessionModel extends Store {
  /**
   *
   * @param sid
   * @param callback
   */
  async destroy(sid: string, callback: (err?: Error) => void) {
    debug(sid, null, `destroy session`);
    await pg.query('call proc_sessions_delete($1)', [sid]);
    callback();
  }

  /**
   *
   * @param sid
   * @param callback
   */
  async get(
    sid: string,
    callback: (err: Error | null, session: MySessionData | null) => void
  ) {
    try {
      const r = await pg.query('select * from func_sessions_get($1)', [sid]);
      const row = r.next()!.oneRow();
      debug(sid, row as TJsonObject, `get session ${JSON.stringify(row)}`);
      if (!row) callback(null, null); // not found
      else {
        const s: SessionData = row['session'] as any;
        callback(null, s);
      }
    } catch (error: any) {
      callback(error, null);
    }
  }

  /**
   *
   * @param sid
   * @param session
   * @param callback
   */
  async set(
    sid: string,
    session: SessionData,
    callback: (err?: Error) => void
  ) {
    const p: any = (session as any).passport;
    const user_id = p?.['user']?.['id'];
    await pg.query('call proc_sessions_set($1, $2, $3)', [
      sid,
      user_id,
      session,
    ]);
    debug(
      sid,
      session as unknown as TJsonObject,
      `set session, maxAge [${SESSION_MAX_AGE}]`
    );
    callback();
  }

  /**
   * @param sid
   * @param session
   * @param callback
   */
  override async touch(
    sid: string,
    session: SessionData,
    callback: (err?: Error) => void
  ) {
    await pg.query('call proc_sessions_touch($1)', [sid]);
    debug(
      sid,
      session as unknown as TJsonObject,
      `touch session, maxAge [${SESSION_MAX_AGE}]`
    );
    callback();
  }
}

//
//

export class FakeSessionStore extends Store {
  _dummy = new Map<string, TJson>();

  /**
   *
   * @param sid
   * @param callback
   */
  destroy(sid: string, callback: (err?: Error) => void) {
    log(EPriority.Debug, 'SESSION_STORE', `destroy session [${sid}]`);
    this._dummy.delete(sid);
    callback();
  }

  /**
   *
   * @param sid
   * @param callback
   */
  get(
    sid: string,
    callback: (err: Error | null, session: SessionData | null) => void
  ) {
    const session = this._dummy.get(sid);
    const username = (session as any)?.['passport']?.['user']?.['username'];
    log(EPriority.Debug, SS, `get session [${sid}] [${username}]`);
    if (session) callback(null, session as unknown as SessionData);
    else callback(null, null); // not found
  }

  /**
   *
   * @param sid
   * @param session
   * @param callback
   */
  set(sid: string, session: SessionData, callback: (err?: Error) => void) {
    const username = (session as any)?.['passport']?.['user']?.['username'];
    log(
      EPriority.Info,
      SS,
      `set session [${sid}] [${username}], maxAge [${SESSION_MAX_AGE}]`
    );
    this._dummy.set(sid, session as unknown as TJsonObject);
    callback();
  }

  /**
   * @param sid
   * @param session
   * @param callback
   */
  override touch(
    sid: string,
    session: SessionData,
    callback: (err?: Error) => void
  ) {
    const username = (session as any)?.['passport']?.['user']?.['username'];
    log(
      EPriority.Info,
      SS,
      `touch session [${sid}] [${username}], maxAge [${SESSION_MAX_AGE}]`
    );
    callback();
  }
}
