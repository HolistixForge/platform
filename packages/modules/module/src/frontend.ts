import { FC, ReactNode } from 'react';
import {
  TCollaborativeChunk,
  TValidSharedDataToCopy,
  TValidSharedData,
  FrontendDispatcher,
} from '@monorepo/collab-engine';
import { TJsonObject } from '@monorepo/simple-types';

import { TGraphNode } from '.';

//

export type TSpaceMenuEntry =
  | {
    type: 'item';
    label: string;
    icon?: string;
    onClick: () => void;
    disabled?: boolean;
    Form?: FC<{}>;
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

//

export type TPanel = { type: string; uuid: string; data: TJsonObject }

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

export type PanelComponent = FC<{ panel: TPanel, closePanel: (uuid: string) => void }>

export type ModuleFrontend = {
  collabChunk: TCollaborativeChunk;

  nodes: Record<string, FC<{ node: TGraphNode<any> }>>;

  spaceMenuEntries: TSpaceMenuEntries;

  panels?: Record<string, PanelComponent>;
};
