import { useCallback } from 'react';

import { Countdown } from '@monorepo/ui-base';
import { useSharedData } from '@monorepo/collab-engine';
import { TCoreSharedData, TProjectMeta } from '@monorepo/core';

//

export const GatewayCountdown = () => {
  const meta: TProjectMeta = useSharedData<TCoreSharedData>(['meta'], (sd) =>
    sd.meta.get('meta')
  );

  const cb = useCallback(() => {}, []);

  if (!meta) return null;
  const { gateway_shutdown } = meta.projectActivity;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50px',
        right: '15px',
        textAlign: 'right',
        width: '100px',
        zIndex: '9',
      }}
    >
      <Countdown targetDate={new Date(gateway_shutdown)} onComplete={cb} />
    </div>
  );
};
