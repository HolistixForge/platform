import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRightIcon } from '@radix-ui/react-icons';

import { TServerEvents } from '@monorepo/servers';
import { TPosition, TEdgeEnd } from '@monorepo/core';
import {
  NewKernelForm,
  NewKernelFormData,
  NewServerForm,
  NewServerFormData,
  NewYoutubeForm,
  NewYoutubeFormData,
  NewVolumeForm,
  NewVolumeFormData,
} from '@monorepo/ui-views';
import { useAction, DialogControlled } from '@monorepo/ui-base';
import { useQueryServerImages } from '@monorepo/frontend-data';
import { Dispatcher } from '@monorepo/collab-engine';
import {
  NewNotionDatabaseForm,
  NewNotionDatabaseFormData,
} from '@monorepo/notion';

import {
  useDispatcher,
  useSharedData,
} from '../../../model/collab-model-chunk';

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
  refCoordinates?: React.MutableRefObject<TPosition>
) => {
  const s_action = useAction<NewServerFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'servers:new',
        from: {
          new: {
            serverName: d.serverName as string,
            imageId: d.imageId as number,
          },
        },
        origin:
          viewId && refCoordinates
            ? {
                viewId: viewId,
                position: {
                  x: refCoordinates.current.x,
                  y: refCoordinates.current.y,
                },
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
    }
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

  const sd = useSharedData(['nodes', 'projectServers'], (sd) => sd);

  // get the origin node data
  const originNodeData = from && sd.nodes.get(from.node);

  const originServerId = originNodeData?.data?.project_server_id as string;
  const originServer =
    originServerId && sd.projectServers.get(`${originServerId}`);

  //

  const server_action = useNewServerAction(dispatcher, viewId, refCoordinates);

  //

  const kernel_action = useAction<NewKernelFormData>(
    (d) => {
      const server = sd.projectServers.get(
        `${originNodeData?.data?.project_server_id}`
      );
      if (server && server.type === 'jupyter')
        return dispatcher.dispatch({
          type: 'jupyter:new-kernel',
          kernelName: d.kernelName as string,
          project_server_id: server.project_server_id,
          origin: {
            viewId: viewId,
            position: {
              x: refCoordinates.current.x,
              y: refCoordinates.current.y,
            },
          },
        });
      else throw new Error('No such server');
    },
    [dispatcher, originNodeData, refCoordinates, sd.projectServers, viewId],
    {
      checkForm: (d, e) => {
        if (!d.kernelName) e.kernelName = 'Please enter a kernel name';
      },
    }
  );

  //

  const youtube_action = useAction<NewYoutubeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-youtube',
        videoId: d.videoId,
        origin: {
          viewId: viewId,
          position: {
            x: refCoordinates.current.x,
            y: refCoordinates.current.y,
          },
        },
      });
    },
    [dispatcher, refCoordinates, viewId],
    {
      checkForm: (d, e) => {
        if (!d.videoId) e.videoId = 'Please enter the youtube video Id';
      },
    }
  );

  //

  const notion_action = useAction<NewNotionDatabaseFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'notion:init-database',
        databaseId: d.databaseId,
        origin: {
          viewId: viewId,
          position: {
            x: refCoordinates.current.x,
            y: refCoordinates.current.y,
          },
        },
      });
    },
    [dispatcher, refCoordinates, viewId],
    {
      checkForm: (d, e) => {
        if (!d.databaseId) e.databaseId = 'Please enter the databse Id';
      },
    }
  );

  //

  const onNewCodeCell = useCallback(() => {
    dispatcher.dispatch({
      type: 'jupyter:new-cell',
      dkid: originNodeData!.data!.dkid as string,
      origin: {
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
      },
    });
  }, [dispatcher, from, originNodeData, refCoordinates, viewId]);

  //

  const onNewTerminal = useCallback(() => {
    const client_id =
      originServer &&
      originServer?.oauth.find((o) => o.service_name === 'jupyterlab')
        ?.client_id;

    if (client_id) {
      dispatcher.dispatch({
        type: 'jupyter:new-terminal',
        project_server_id: originServer.project_server_id as number,
        origin: {
          viewId: viewId,
          position: {
            x: refCoordinates.current.x,
            y: refCoordinates.current.y,
          },
        },
        client_id,
      });
    }
  }, [dispatcher, from, originServer, refCoordinates, viewId]);

  //

  const volume_action = useAction<NewVolumeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'servers:new-volume',
        name: d.name as string,
        storage: d.storage as number,
        origin: {
          viewId: viewId,
          position: {
            x: refCoordinates.current.x,
            y: refCoordinates.current.y,
          },
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
    }
  );

  //

  const onNewChatBox = useCallback(() => {
    dispatcher.dispatch({
      type: 'chats:new-chat',
      origin: {
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
      },
    });
  }, [dispatcher, refCoordinates, viewId]);

  //

  const onNewTextEditor = useCallback(() => {
    dispatcher.dispatch({
      type: 'socials:new-text-editor',
      origin: {
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
      },
    });
  }, [dispatcher, refCoordinates, viewId]);

  //

  const context = useMemo<TMenuContext>(() => {
    return {
      new: [
        {
          title: 'Server',
          onClick: server_action.open,
          disabled: from !== undefined,
        },

        {
          title: 'Kernel',
          onClick: kernel_action.open,
          disabled: !(
            originNodeData?.type === 'server' &&
            from?.connectorName === 'outputs'
          ),
        },
        {
          title: 'Terminal',
          onClick: onNewTerminal,
          disabled: !(
            originNodeData?.type === 'server' &&
            from?.connectorName === 'outputs'
          ),
        },
        {
          title: 'Code Cell',
          onClick: onNewCodeCell,
          disabled: !(
            (originNodeData?.type === 'jupyter-kernel' ||
              originNodeData?.type === 'jupyter-cell') &&
            from?.connectorName === 'outputs'
          ),
        },
        { separator: true },
        /*
        {
          title: 'Volume',
          onClick: v_action.open,
          disabled: from !== undefined,
        },
        { separator: true },
        */
        {
          title: 'Chat Box',
          onClick: onNewChatBox,
          disabled: false,
        },
        { separator: true },
        {
          title: 'Notion Database',
          onClick: notion_action.open,
          disabled: false,
        },
        { separator: true },
        {
          title: 'Text Editor',
          onClick: onNewTextEditor,
          disabled: false,
        },
        {
          title: 'Youtube Embedding',
          onClick: youtube_action.open,
          disabled: from !== undefined,
        },
      ],
    };
  }, [
    server_action.open,
    from,
    kernel_action.open,
    originNodeData,
    onNewTerminal,
    onNewCodeCell,
    // v_action.open,
    onNewChatBox,
    youtube_action.open,
    notion_action.open,
    onNewTextEditor,
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
        open={server_action.isOpened}
        onOpenChange={server_action.close}
      >
        <NewServerForm
          images={status === 'success' ? data._0 : undefined}
          action={server_action}
        />
      </DialogControlled>

      <DialogControlled
        title="New Kernel"
        description="Choose a name for the new kernel."
        open={kernel_action.isOpened}
        onOpenChange={kernel_action.close}
      >
        <NewKernelForm action={kernel_action} />
      </DialogControlled>

      <DialogControlled
        title="New Youtube video"
        description="Paste the video's id"
        open={youtube_action.isOpened}
        onOpenChange={youtube_action.close}
      >
        <NewYoutubeForm action={youtube_action} />
      </DialogControlled>

      <DialogControlled
        title="New Volume"
        description="Choose a name and storage capacity for your new volume."
        open={volume_action.isOpened}
        onOpenChange={volume_action.close}
      >
        <NewVolumeForm action={volume_action} />
      </DialogControlled>

      <DialogControlled
        title="New Notion Database"
        description="Provide the Notion Database Id."
        open={notion_action.isOpened}
        onOpenChange={notion_action.close}
      >
        <NewNotionDatabaseForm action={notion_action} />
      </DialogControlled>
    </menuContext.Provider>
  );
};
