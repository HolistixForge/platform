import { FC, ReactNode } from 'react';

import { TValidSharedData } from '@holistix/collab-engine';
import { TValidSharedDataToCopy } from '@holistix/collab/frontend';
import { FrontendDispatcher } from '@holistix/reducers/frontend';
import { makeUuid, TJsonObject } from '@holistix/simple-types';

import { SHAPE_TYPES, TEventNewShape, TSpaceEvent } from './space-events';

//

export type TSpaceMenuEntry =
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
      entries: TSpaceMenuEntry[];
      disabled?: boolean;
    };

export type TPanel = { type: string; uuid: string; data: TJsonObject };

export type TSpaceMenuEntries = (a: {
  viewId: string;
  from?: { node: string; connectorName: string; pinName?: string };
  sharedData: TValidSharedDataToCopy<TValidSharedData>;
  position: () => { x: number; y: number };
  renderForm: (form: ReactNode) => void;
  renderPanel: (panel: TPanel) => void;
  closePanel: (uuid: string) => void;
  dispatcher: FrontendDispatcher<any>;
}) => TSpaceMenuEntry[];

//

export const spaceMenuEntries: TSpaceMenuEntries = ({
  viewId,
  from,
  sharedData,
  position,
  renderForm,
  dispatcher,
}) => {
  const d = dispatcher as FrontendDispatcher<TSpaceEvent>;
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
              type: 'space:new-group',
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
              type: 'space:new-shape',
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
