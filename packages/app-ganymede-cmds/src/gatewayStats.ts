import { pg } from './pg';
import { EPriority, log } from '@holistix/log';

export const gatewayStats = async () => {
  const r = await pg.query('SELECT * FROM public.func_gateway_stats()', []);
  const stats = r.next()!.oneRow();

  log(EPriority.Info, 'GATEWAY_STATS', 'stats: ', stats);
};
