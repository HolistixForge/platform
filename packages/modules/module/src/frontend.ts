import { FC, ReactNode } from 'react';
import { TGraphNode } from '.';
import {
  TCollaborativeChunk,
  TValidSharedDataToCopy,
  TValidSharedData,
} from '@monorepo/collab-engine';

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

export type TSpaceMenuEntries = (a: {
  viewId: string;
  from?: { node: string; connectorName: string; pinName?: string };
  sd: TValidSharedDataToCopy<TValidSharedData>;
  position: () => { x: number; y: number };
  renderForm: (form: ReactNode) => void;
}) => TSpaceMenuEntry[];

//

export type ModuleFrontend = {
  collabChunk: TCollaborativeChunk;

  nodes: Record<string, FC<{ node: TGraphNode<any> }>>;

  spaceMenuEntries: TSpaceMenuEntries;
};
