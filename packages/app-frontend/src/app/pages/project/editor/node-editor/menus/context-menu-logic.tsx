import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRightIcon } from '@radix-ui/react-icons';

import { TPosition, TEdgeEnd } from '@monorepo/core';
import { NewYoutubeForm, NewYoutubeFormData } from '@monorepo/ui-views';
import { useAction, DialogControlled } from '@monorepo/ui-base';
import {
  NewNotionDatabaseForm,
  NewNotionDatabaseFormData,
} from '@monorepo/notion/frontend';
import { NewIframeForm, NewIframeFormData } from '@monorepo/socials/frontend';
import {
  NewNodeUserForm,
  NewNodeUserFormData,
} from '@monorepo/socials/frontend';

import {
  useDispatcher,
  AllSharedData,
} from '../../../model/collab-model-chunk';

import { TValidSharedDataToCopy, useSharedData } from '@monorepo/collab-engine';

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
  position: React.MutableRefObject<TPosition>;
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
                                  position: context.position.current,
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

  //

  const dispatcher = useDispatcher();

  const sd: TValidSharedDataToCopy<AllSharedData> =
    useSharedData<AllSharedData>(
      ['nodes', 'projectServers', 'graphViews'],
      (sd) => sd
    );

  const gv = sd.graphViews.get(viewId);
  const filterOutNodes = gv?.params.filterOutNodes?.map((n) => sd.nodes.get(n));

  // get the origin node data
  const originNodeData = from && sd.nodes.get(from.node);

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

  const getHiddenNodesByType = (type: string) => {
    return filterOutNodes
      ?.filter((n) => n?.type === type)
      .map((n) => ({ id: n?.id as string, name: n?.name as string }));
  };

  //

  const context = useMemo<TMenuContext>(() => {
    return {
      viewId: viewId,
      position: refCoordinates,
      new: [
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
    from,
    originNodeData,
    youtube_action.open,
    notion_action.open,
    onNewTextEditor,
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
        title="New Youtube video"
        description="Paste the video's id"
        open={youtube_action.isOpened}
        onOpenChange={youtube_action.close}
      >
        <NewYoutubeForm action={youtube_action} />
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
