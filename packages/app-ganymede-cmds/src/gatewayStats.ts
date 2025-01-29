import { pg } from './pg';
import { log } from '@monorepo/log';

export const gatewayStats = async () => {
  const r = await pg.query('SELECT * FROM public.func_gateway_stats()', []);
  const stats = r.next().oneRow();

  log(6, 'GATEWAY_STATS', 'stats: ', stats);
};
