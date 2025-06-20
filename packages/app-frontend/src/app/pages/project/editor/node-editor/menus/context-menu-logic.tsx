import React, { ReactNode, createContext, useMemo } from 'react';

import { TPosition, TEdgeEnd } from '@monorepo/core';
import { useAction, DialogControlled } from '@monorepo/ui-base';
import {
  NewNotionDatabaseForm,
  NewNotionDatabaseFormData,
} from '@monorepo/notion/frontend';

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
      position: refCoordinates,
      new: [
        {
          title: 'Notion Database',
          onClick: notion_action.open,
          disabled: false,
          hiddenNodes: getHiddenNodesByType('notion-database'),
        },
      ],
    };
  }, [
    filterOutNodes,
    refCoordinates.current.x,
    refCoordinates.current.y,
    from,
    originNodeData,
    notion_action.open,
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
