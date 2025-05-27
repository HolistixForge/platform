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
import {
  NewNotionDatabaseForm,
  NewNotionDatabaseFormData,
} from '@monorepo/notion/frontend';
import { makeUuid } from '@monorepo/simple-types';
import { SHAPE_TYPES, TEventNewShape } from '@monorepo/space';
import { NewIframeForm, NewIframeFormData } from '@monorepo/socials/frontend';
import {
  NewNodeUserForm,
  NewNodeUserFormData,
} from '@monorepo/socials/frontend';

import {
  useDispatcher,
  useSharedData,
  AllSharedData,
} from '../../../model/collab-model-chunk';
import {
  FrontendDispatcher,
  TValidSharedDataToCopy,
} from '@monorepo/collab-engine';

/**
 *
 *
 *
 */

type TMenuEntry = {
  title: string;
  onClick: () => void;
  disabled: boolean;
  hiddenNodes?: { id: string; name: string }[];
};
type TSeparator = { separator: true };

type TMenuContext = {
  new: (TMenuEntry | TSeparator)[];
  viewId: string;
  position: TPosition;
};

const menuContext = createContext<TMenuContext | null>(null);

/**
 *
 */
export const ContextMenuNew = () => {
  const context = useContext(menuContext) as TMenuContext;
  const dispatcher = useDispatcher();
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
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
                    {menuEntry.title}
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
                      <ContextMenu.Item
                        key={k}
                        className="ContextMenuItem"
                        onClick={
                          menuEntry.disabled ? undefined : menuEntry.onClick
                        }
                        disabled={menuEntry.disabled}
                      >
                        New...
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        key={k}
                        className="ContextMenuSeparator"
                      />
                      {menuEntry.hiddenNodes &&
                        menuEntry.hiddenNodes.map((node) => {
                          return (
                            <ContextMenu.Item
                              key={node.id}
                              className="ContextMenuItem"
                              onClick={async () => {
                                await dispatcher.dispatch({
                                  type: 'space:unfilter-out-node',
                                  viewId: context.viewId,
                                  nid: node.id,
                                  position: context.position,
                                });
                                await dispatcher.dispatch({
                                  type: 'space:move-node',
                                  viewId: context.viewId,
                                  nid: node.id,
                                  position: context.position,
                                });
                              }}
                            >
                              {node.name}
                            </ContextMenu.Item>
                          );
                        })}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
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
  dispatcher: FrontendDispatcher<TServerEvents>,
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

  const sd: TValidSharedDataToCopy<AllSharedData> = useSharedData(
    ['nodes', 'projectServers', 'graphViews'],
    (sd) => sd
  );

  const gv = sd.graphViews.get(viewId);
  const filterOutNodes = gv?.params.filterOutNodes?.map((n) => sd.nodes.get(n));

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

  const iframe_action = useAction<NewIframeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-iframe',
        src: d.src,
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
        if (!d.src) e.src = 'Please enter the iframe source URL';
      },
    }
  );

  //

  const nodeUser_action = useAction<NewNodeUserFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-node-user',
        userId: d.userId,
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
        if (!d.userId) e.userId = 'Please select a user';
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

  const onNewGroup = useCallback(() => {
    dispatcher.dispatch({
      type: 'space:new-group',
      groupId: makeUuid(),
      title: 'New Group',
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

  const onNewShape = useCallback(() => {
    const event: TEventNewShape = {
      type: 'space:new-shape',
      shapeId: makeUuid(),
      shapeType: SHAPE_TYPES.CIRCLE, // Default to circle
      origin: {
        viewId: viewId,
        position: {
          x: refCoordinates.current.x,
          y: refCoordinates.current.y,
        },
      },
    };
    dispatcher.dispatch(event);
  }, [dispatcher, refCoordinates, viewId]);

  //

  const getHiddenNodesByType = (type: string) => {
    return filterOutNodes
      ?.filter((n) => n?.type === type)
      .map((n) => ({ id: n?.id as string, name: n?.name as string }));
  };

  //

  const context = useMemo<TMenuContext>(() => {
    return {
      viewId: viewId,
      position: refCoordinates.current,
      new: [
        {
          title: 'Group',
          onClick: onNewGroup,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('group'),
        },
        {
          title: 'Shape',
          onClick: onNewShape,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('shape'),
        },
        { separator: true },

        {
          title: 'Server',
          onClick: server_action.open,
          disabled: from !== undefined,
          hiddenNodes: getHiddenNodesByType('server'),
        },

        {
          title: 'Kernel',
          onClick: kernel_action.open,
          disabled: !(
            originNodeData?.type === 'server' &&
            from?.connectorName === 'outputs'
          ),
          hiddenNodes: getHiddenNodesByType('jupyter-kernel'),
        },
        {
          title: 'Terminal',
          onClick: onNewTerminal,
          disabled: !(
            originNodeData?.type === 'server' &&
            from?.connectorName === 'outputs'
          ),
          hiddenNodes: getHiddenNodesByType('jupyter-terminal'),
        },
        {
          title: 'Code Cell',
          onClick: onNewCodeCell,
          disabled: !(
            (originNodeData?.type === 'jupyter-kernel' ||
              originNodeData?.type === 'jupyter-cell') &&
            from?.connectorName === 'outputs'
          ),
          hiddenNodes: getHiddenNodesByType('jupyter-cell'),
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
          hiddenNodes: getHiddenNodesByType('chat-anchor'),
        },
        { separator: true },
        {
          title: 'Notion Database',
          onClick: notion_action.open,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('notion-database'),
        },
        { separator: true },
        {
          title: 'Text Editor',
          onClick: onNewTextEditor,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('text-editor'),
        },
        {
          title: 'User Node',
          onClick: nodeUser_action.open,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('node-user'),
        },
        {
          title: 'Youtube Embedding',
          onClick: youtube_action.open,
          disabled: from !== undefined,
          hiddenNodes: getHiddenNodesByType('youtube'),
        },
        {
          title: 'Iframe',
          onClick: iframe_action.open,
          disabled: from !== undefined,
          hiddenNodes: getHiddenNodesByType('iframe'),
        },
      ],
    };
  }, [
    filterOutNodes,
    refCoordinates.current.x,
    refCoordinates.current.y,
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
    onNewGroup,
    onNewShape,
    iframe_action.open,
    nodeUser_action.open,
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

      <DialogControlled
        title="New Iframe"
        description="Enter the URL to embed in the iframe"
        open={iframe_action.isOpened}
        onOpenChange={iframe_action.close}
      >
        <NewIframeForm action={iframe_action} />
      </DialogControlled>

      <DialogControlled
        title="Add User Node"
        description="Search and select a user to add as a node."
        open={nodeUser_action.isOpened}
        onOpenChange={nodeUser_action.close}
      >
        <NewNodeUserForm action={nodeUser_action} />
      </DialogControlled>
    </menuContext.Provider>
  );
};
