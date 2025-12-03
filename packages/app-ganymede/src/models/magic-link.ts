import { UnknownException } from '@holistix/log';
import { pg } from '../database/pg';

export class MagicLinkModel {
  async set(key: string, value: { [k: string]: number }): Promise<void> {
    // console.log('SET', { key, value });
    const token = Object.keys(value).find((k) => k.startsWith('e')); // jwt base64 start with 'ey...'

    if (!token) {
      throw new UnknownException('oops');
    }

    const exp = new Date(value[token] * 1000);

    await pg.query('call proc_magic_links_set($1, $2, $3)', [
      key,
      JSON.stringify(value),
      exp.toISOString(),
    ]);
  }

  //

  async get(key: string): Promise<{ [k: string]: number } | undefined> {
    const r = await pg.query('select * from func_magic_links_get($1)', [key]);
    const row = r.next()!.oneRow();
    const value = row ? (row['token'] as { [k: string]: number }) : undefined;
    // console.log('GET', { key, value });
    return value;
  }
}
