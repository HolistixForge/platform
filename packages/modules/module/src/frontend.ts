import { FC } from 'react';
import { TGraphNode } from '.';
import { TCollaborativeChunk } from '@monorepo/collab-engine';

//

export type ModuleFrontend = {
  collabChunk: TCollaborativeChunk;

  nodes: Record<string, FC<{ node: TGraphNode<any> }>>;

  spaceMenuEntries: {
    label: string;
    icon: string;
    onClick: () => void;
  }[];
};
