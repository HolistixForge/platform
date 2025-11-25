import { FC } from 'react';

import { TModule } from '@monorepo/module';
import { TCollabFrontendExports } from '@monorepo/collab/frontend';
import { TGraphNode } from '@monorepo/core-graph';

import { Group } from './lib/components/group/group';
import { Shape } from './lib/components/shape/shape';
import {
  spaceMenuEntries,
  TSpaceMenuEntries,
  TSpaceMenuEntry,
} from './lib/space-menu';
import {
  TLayerProvider,
  LayerViewportAdapter,
} from './lib/components/layer-types';
import { TJsonObject } from '@monorepo/simple-types';

import './lib/components/css/index.scss';

//

export {
  InputsAndOutputs,
  Outputs,
  Inputs,
} from './lib/components/assets/inputsOutputs/inputsOutputs';
export { EdgeComponent } from './lib/components/assets/edges/edge';
export { DisableZoomDragPan } from './lib/components/node-wrappers/disable-zoom-drag-pan';
export { NodeMainToolbar } from './lib/components/assets/node-header/node-main-toolbar';
export { NodeHeader } from './lib/components/assets/node-header/node-header';
export {
  useMakeButton,
  useNodeHeaderButtons,
} from './lib/components/assets/node-header/node-main-toolbar';
export { useTestToolbarButtons } from './lib/components/assets/node-header/node-main-toolbar';
export { useConnector } from './lib/components/assets/inputsOutputs/inputsOutputs';
export { useNodeContext } from './lib/components/node-wrappers/node-wrapper';
export {
  LabelEnd,
  LabelMiddle,
  LabelStart,
} from './lib/components/assets/edges/edge';

export type { TNodeContext } from './lib/components/apis/types/node';

export { DemiurgeSpace } from './lib/components/demiurge-space';

export { useLayerContext } from './lib/components/layer-context';

export type { TLayerTreeItem } from './lib/layer-tree-types';

export type { TLayerProvider, LayerViewportAdapter };

export type { TSpaceMenuEntries, TSpaceMenuEntry };

type TRequired = {
  collab: TCollabFrontendExports;
};

export type TPanel = { type: string; uuid: string; data: TJsonObject };

export type PanelComponent = FC<{
  panel: TPanel;
  closePanel: (uuid: string) => void;
}>;

export type TUIElements = {
  panels: Record<string, PanelComponent>;
  getMenuEntries: TSpaceMenuEntries;
  nodes: { [key: string]: FC<{ node: TGraphNode<never> }> };
  layers: TLayerProvider[];
};

const modulesMenuEntries: TSpaceMenuEntries[] = [];

const uiElements: TUIElements = {
  panels: {},
  getMenuEntries: (args) => {
    return modulesMenuEntries.reduce((acc, module) => {
      try {
        const entries = module(args);
        return [...acc, ...entries];
      } catch (error) {
        console.error(
          'Error getting menu entries for module',
          module.name,
          error
        );
        return acc;
      }
    }, [] as TSpaceMenuEntry[]);
  },
  nodes: {},
  layers: [],
};

export type TSpaceFrontendExports = {
  registerMenuEntries: (entries: TSpaceMenuEntries) => void;
  registerNodes: (nodes: {
    [key: string]: FC<{ node: TGraphNode<never> }>;
  }) => void;
  registerLayer: (layers: TLayerProvider) => void;
  registerPanel: (panels: Record<string, PanelComponent>) => void;
  uiElements: TUIElements;
};

//

export const moduleFrontend: TModule<TRequired, TSpaceFrontendExports> = {
  name: 'space',
  version: '0.0.1',
  description: 'Space module',
  dependencies: ['core-graph'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'space', 'graphViews');

    const exports: TSpaceFrontendExports = {
      registerMenuEntries: (entries) => {
        modulesMenuEntries.push(entries);
      },
      registerNodes: (newNodes) => {
        uiElements.nodes = { ...uiElements.nodes, ...newNodes };
      },
      registerLayer: (newLayer) => {
        uiElements.layers.push(newLayer);
      },
      registerPanel: (newPanels) => {
        uiElements.panels = { ...uiElements.panels, ...newPanels };
      },
      uiElements,
    };

    exports.registerMenuEntries(spaceMenuEntries);
    exports.registerNodes({
      group: Group,
      shape: Shape,
    });

    moduleExports(exports);
  },
};
