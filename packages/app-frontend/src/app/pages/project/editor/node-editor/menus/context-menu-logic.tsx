import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useDispatcher, useSharedData } from '../../../model/collab-model-chunk';
import {
  TEdgeEnd,
  TNodeKernel,
  TNodeServer,
  TPosition,
  TServerEvents,
  jupyterlabIsReachable,
} from '@monorepo/demiurge-types';
import {
  NewKernelForm,
  NewKernelFormData,
  NewServerForm,
  NewServerFormData,
  NewYoutubeForm,
  NewYoutubeFormData,
  NewVolumeForm,
  NewVolumeFormData,
  useAction,
  DialogControlled,
} from '@monorepo/demiurge-ui-components';
import { useQueryServerImages } from '@monorepo/demiurge-data';
import { Dispatcher } from '@monorepo/collaborative';

/**
 *
 *
 *
 */

type TMenuEntry = {
  title: string;
  onClick: () => void;
  disabled: boolean;
};
type TSeparator = { separator: true };

type TMenuContext = {
  new: (TMenuEntry | TSeparator)[];
};

const menuContext = createContext<TMenuContext | null>(null);

/**
 *
 */
export const ContextMenuNew = () => {
  const context = useContext(menuContext) as TMenuContext;

  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
        New
        <div className="RightSlot">
          <ChevronRightIcon />
        </div>
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent
          className="ContextMenuSubContent"
          sideOffset={2}
          alignOffset={-5}
        >
          {context.new.map((menuEntry, k) => {
            if ((menuEntry as TSeparator).separator)
              return (
                <ContextMenu.Separator
                  key={k}
                  className="ContextMenuSeparator"
                />
              );
            else {
              menuEntry = menuEntry as TMenuEntry;
              return (
                <ContextMenu.Item
                  key={k}
                  className="ContextMenuItem"
                  onClick={menuEntry.disabled ? undefined : menuEntry.onClick}
                  disabled={menuEntry.disabled}
                >
                  {menuEntry.title}
                </ContextMenu.Item>
              );
            }
          })}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
};

/**
 *
 *
 *
 */

export const useNewServerAction = (
  dispatcher: Dispatcher<TServerEvents, Record<string, never>>,
  viewId?: string,
  refCoordinates?: React.MutableRefObject<TPosition>,
) => {
  const s_action = useAction<NewServerFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'new-server',
        serverName: d.serverName as string,
        imageId: d.imageId as number,
        viewId: viewId,
        position: refCoordinates
          ? {
              x: refCoordinates.current.x,
              y: refCoordinates.current.y,
            }
          : undefined,
      });
    },
    [dispatcher, refCoordinates, viewId],
    {
      checkForm: (d, e) => {
        if (d.imageId === undefined) e.imageId = 'Please select a server image';
        if (!d.serverName)
          e.serverName = 'Please choose a name for the new server';
      },
    },
  );

  return s_action;
};

//

export const ContextMenuLogic = ({
  refCoordinates,
  viewId,
  from,
  children,
}: {
  refCoordinates: React.MutableRefObject<TPosition>;
  viewId: string;
  from: TEdgeEnd | undefined;
  children: ReactNode;
}) => {
  //

  const { status, data } = useQueryServerImages();

  //

  const dispatcher = useDispatcher();

  const sd = useSharedData(['nodeData'], (sd) => sd);

  // get the origin node data
  const originNodeData = from && sd.nodeData.get(from.node);

  /**
   *
   * new server
   *
   */

  const s_action = useNewServerAction(dispatcher, viewId, refCoordinates);

  /**
   *
   * new kernel
   *
   */

  const k_action = useAction<NewKernelFormData>(
    (d) => {
      const server = sd.projectServers.get(
        `${(originNodeData as TNodeServer).project_server_id}`,
      );
      if (server && server.type === 'jupyter' && jupyterlabIsReachable(server))
        return dispatcher.dispatch({
          type: 'new-kernel',
          kernelName: d.kernelName as string,
          project_server_id: server.project_server_id,
          viewId: viewId,
          position: {
            x: refCoordinates.current.x,
            y: refCoordinates.current.y,
          },
        });
      else throw new Error('No such server');
    },
    [dispatcher, originNodeData, refCoordinates, sd.projectServers, viewId],
    {
      checkForm: (d, e) => {
        if (!d.kernelName) e.kernelName = 'Please enter a kernel name';
      },
    },
  );

  /**
   *
   * new youtube
   *
   */

  const y_action = useAction<NewYoutubeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'new-node',
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
        nodeData: {
          type: 'video',
          youtubeId: d.videoId,
        },
      });
    },
    [dispatcher, refCoordinates, viewId],
    {
      checkForm: (d, e) => {
        if (!d.videoId) e.videoId = 'Please enter the youtube video Id';
      },
    },
  );

  /**
   *
   * new code cell
   *
   */

  const onNewCodeCell = useCallback(() => {
    dispatcher.dispatch({
      type: 'new-node',
      viewId: viewId,
      position: {
        x: refCoordinates.current.x,
        y: refCoordinates.current.y,
      },
      nodeData: {
        type: 'python',
        code: 'print("hello world !")',
        dkid: (originNodeData as TNodeKernel).dkid,
      },
      from,
    });
  }, [dispatcher, from, originNodeData, refCoordinates, viewId]);

  /**
   *
   * new terminal
   *
   */

  const onNewTerminal = useCallback(() => {
    dispatcher.dispatch({
      type: 'new-node',
      viewId: viewId,
      position: {
        x: refCoordinates.current.x,
        y: refCoordinates.current.y,
      },
      nodeData: {
        type: 'terminal',
        server_name: (originNodeData as TNodeServer).server_name,
        project_server_id: (originNodeData as TNodeServer).project_server_id,
      },
      from,
      edgeData: { demiurge_type: 'terminal' },
    });
  }, [dispatcher, from, originNodeData, refCoordinates, viewId]);

  /**
   *
   * new volume
   *
   */

  const v_action = useAction<NewVolumeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'new-volume',
        name: d.name as string,
        storage: d.storage as number,
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
      });
    },
    [dispatcher, refCoordinates, viewId],
    {
      checkForm: (d, e) => {
        if (d.storage === undefined || d.storage < 0)
          e.storage = 'storage capacity must be greater than 0 Gi';
        else if (d.storage > 20)
          e.storage = 'storage capacity must be less than 20 Gi';
        if (!d.name) e.name = 'Please choose a name for the new volume';
      },
    },
  );

  /**
   *
   * new terminal
   *
   */

  const onNewChatBox = useCallback(() => {
    dispatcher.dispatch({
      type: 'new-chat',
      viewId: viewId,
      position: {
        x: refCoordinates.current.x,
        y: refCoordinates.current.y,
      },
    });
  }, [dispatcher, refCoordinates, viewId]);

  /**
   *
   *
   *
   */

  const context = useMemo<TMenuContext>(() => {
    return {
      new: [
        {
          title: 'Server',
          onClick: s_action.open,
          disabled: from !== undefined,
        },
        /*
        {
          title: 'Kernel',
          onClick: k_action.open,
          disabled:
            originNodeData &&
            originNodeData.type === 'server' &&
            from &&
            from.connector === undefined
              ? false
              : true,
        },
        {
          title: 'Terminal',
          onClick: onNewTerminal,
          disabled:
            originNodeData &&
            originNodeData.type === 'server' &&
            from &&
            from.connector === undefined
              ? false
              : true,
        },
        {
          title: 'Code Cell',
          onClick: onNewCodeCell,
          disabled:
            originNodeData &&
            (originNodeData.type === 'kernel' ||
              originNodeData.type === 'python') &&
            from &&
            from.connector === undefined
              ? false
              : true,
        },
        { separator: true },
        {
          title: 'Volume',
          onClick: v_action.open,
          disabled: from !== undefined,
        },
        */
        { separator: true },
        {
          title: 'Chat Box',
          onClick: onNewChatBox,
          disabled: false,
        },
        { separator: true },
        {
          title: 'Youtube Embedding',
          onClick: y_action.open,
          disabled: from !== undefined,
        },
      ],
    };
  }, [
    s_action.open,
    from,
    // k_action.open,
    // originNodeData,
    // onNewTerminal,
    // onNewCodeCell,
    // v_action.open,
    onNewChatBox,
    y_action.open,
  ]);

  /**
   *
   *
   *
   */

  return (
    <menuContext.Provider value={context}>
      {children}

      <DialogControlled
        title="New server"
        description="Choose a name and select an image for your new server."
        open={s_action.isOpened}
        onOpenChange={s_action.close}
      >
        <NewServerForm
          images={status === 'success' ? data._0 : undefined}
          action={s_action}
        />
      </DialogControlled>

      <DialogControlled
        title="New Kernel"
        description="Choose a name for the new kernel."
        open={k_action.isOpened}
        onOpenChange={k_action.close}
      >
        <NewKernelForm action={k_action} />
      </DialogControlled>

      <DialogControlled
        title="New Youtube video"
        description="Paste the video's id"
        open={y_action.isOpened}
        onOpenChange={y_action.close}
      >
        <NewYoutubeForm action={y_action} />
      </DialogControlled>

      <DialogControlled
        title="New Volume"
        description="Choose a name and storage capacity for your new volume."
        open={v_action.isOpened}
        onOpenChange={v_action.close}
      >
        <NewVolumeForm action={v_action} />
      </DialogControlled>
    </menuContext.Provider>
  );
};
