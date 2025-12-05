import { FC, ReactNode } from 'react';

import { TValidSharedData } from '@holistix-forge/collab-engine';
import { TValidSharedDataToCopy } from '@holistix-forge/collab/frontend';
import { FrontendDispatcher } from '@holistix-forge/reducers/frontend';
import { makeUuid, TJsonObject } from '@holistix-forge/simple-types';

import { SHAPE_TYPES, TEventNewShape, TWhiteboardEvent } from './whiteboard-events';

//

export type TWhiteboardMenuEntry =
  | {
      type: 'item';
      label: string;
      icon?: string;
      onClick: () => void;
      disabled?: boolean;
      Form?: FC;
    }
  | {
      type: 'separator';
    }
  | {
      type: 'label';
      label: string;
    }
  | {
      type: 'sub-menu';
      label: string;
      icon?: string;
      entries: TWhiteboardMenuEntry[];
      disabled?: boolean;
    };

export type TPanel = { type: string; uuid: string; data: TJsonObject };

export type TWhiteboardMenuEntries = (a: {
  viewId: string;
  from?: { node: string; connectorName: string; pinName?: string };
  sharedData: TValidSharedDataToCopy<TValidSharedData>;
  projectId: string;
  position: () => { x: number; y: number };
  renderForm: (form: ReactNode) => void;
  renderPanel: (panel: TPanel) => void;
  closePanel: (uuid: string) => void;
  dispatcher: FrontendDispatcher<any>;
}) => TWhiteboardMenuEntry[];

//

export const whiteboardMenuEntries: TWhiteboardMenuEntries = ({
  viewId,
  from,
  sharedData,
  position,
  renderForm,
  dispatcher,
}) => {
  const d = dispatcher as FrontendDispatcher<TWhiteboardEvent>;
  return [
    {
      type: 'sub-menu',
      label: 'Space basics',
      entries: [
        {
          type: 'item',
          label: 'New Group',

          onClick: () => {
            d.dispatch({
              type: 'whiteboard:new-group',
              groupId: makeUuid(),
              title: 'New Group',
              origin: {
                viewId: viewId,
                position: position(),
              },
            });
          },
        },
        {
          type: 'item',
          label: 'New Shape',
          onClick: () => {
            const event: TEventNewShape = {
              type: 'whiteboard:new-shape',
              shapeId: makeUuid(),
              shapeType: SHAPE_TYPES.CIRCLE, // Default to circle
              origin: {
                viewId: viewId,
                position: position(),
              },
            };
            d.dispatch(event);
          },
        },
      ],
    },
  ];
};
