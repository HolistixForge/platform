import { useCallback } from 'react';

import {
  Countdown,
  DialogControlled,
  useAction,
  ButtonBase,
} from '@holistix-forge/ui-base';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  TGatewaySharedData,
  TGatewayMeta,
  TEventDisableProjectUnloading,
} from '@holistix-forge/gateway';
//

export const ProjectCountdown = () => {
  const meta: TGatewayMeta = useLocalSharedData<TGatewaySharedData>(
    ['gateway:gateway'],
    (sd) => sd['gateway:gateway'].get('meta')
  );

  const cb = useCallback(() => {
    /*  */
  }, []);

  const dispatcher = useDispatcher<TEventDisableProjectUnloading>();

  const confirmAction = useAction(
    async () => {
      dispatcher.dispatch({
        type: 'gateway:disable-project-unloading',
      });
    },
    [dispatcher],
    {
      closeOnSuccess: true,
    }
  );

  const disableProjectUnloading = useCallback(() => {
    confirmAction.open();
  }, [confirmAction]);

  if (!meta) return null;
  const { project_cleanup_time, disable_project_cleanup } = meta.projectActivity;

  if (disable_project_cleanup) return null;

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
        onClick={disableProjectUnloading}
      >
        <Countdown targetDate={new Date(project_cleanup_time)} onComplete={cb} />
      </div>

      <DialogControlled
        title="Disable Project Auto-Unload"
        description="Are you sure you want to disable the project auto-unload timer? The project will stay loaded even if idle."
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
            text="Keep Project Loaded"
            callback={confirmAction.callback}
            loading={confirmAction.loading}
          />
        </div>
      </DialogControlled>
    </>
  );
};
