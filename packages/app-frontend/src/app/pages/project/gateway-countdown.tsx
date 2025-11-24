import { useCallback } from 'react';

import {
  Countdown,
  DialogControlled,
  useAction,
  ButtonBase,
} from '@monorepo/ui-base';
import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';
import {
  TGatewaySharedData,
  TGatewayMeta,
  TEventDisableShutdown,
} from '@monorepo/gateway';
//

export const GatewayCountdown = () => {
  const meta: TGatewayMeta = useLocalSharedData<TGatewaySharedData>(
    ['gateway:gateway'],
    (sd) => sd['gateway:gateway'].get('unique')
  );

  const cb = useCallback(() => {
    /*  */
  }, []);

  const dispatcher = useDispatcher<TEventDisableShutdown>();

  const confirmAction = useAction(
    async () => {
      dispatcher.dispatch({
        type: 'gateway:disable-shutdown',
      });
    },
    [dispatcher],
    {
      closeOnSuccess: true,
    }
  );

  const disableGatewayShutdown = useCallback(() => {
    confirmAction.open();
  }, [confirmAction]);

  if (!meta) return null;
  const { gateway_shutdown, disable_gateway_shutdown } = meta.projectActivity;

  if (disable_gateway_shutdown) return null;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '50px',
          right: '15px',
          textAlign: 'right',
          width: 'fit-content',
          cursor: 'pointer',
          zIndex: '9',
        }}
        onClick={disableGatewayShutdown}
      >
        <Countdown targetDate={new Date(gateway_shutdown)} onComplete={cb} />
      </div>

      <DialogControlled
        title="Disable Gateway Shutdown"
        description="Are you sure you want to disable the gateway shutdown timer?"
        open={confirmAction.isOpened}
        onOpenChange={confirmAction.close}
      >
        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}
        >
          <ButtonBase
            className=""
            text="Cancel"
            callback={confirmAction.close}
          />
          <ButtonBase
            className="red"
            text="Disable"
            callback={confirmAction.callback}
            loading={confirmAction.loading}
          />
        </div>
      </DialogControlled>
    </>
  );
};
