import { FC } from 'react';

import { TModule } from '@monorepo/module';
import { TCollabFrontendExports } from '@monorepo/collab/frontend';
import { TGraphNode } from '@monorepo/core-graph';

import { Group } from './lib/components/group/group';
import { Shape } from './lib/components/shape/shape';
import { spaceMenuEntries, TSpaceMenuEntries } from './lib/space-menu';
import './lib/index.scss';
import { TLayerProvider } from './lib/components/layer-types';
import { TJsonObject } from '@monorepo/simple-types';

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

export { HolistixSpace } from './lib/components/holistix-space';

export { useLayerContext } from './lib/components/layer-context';

export type { TLayerTreeItem } from './lib/layer-tree-types';

type TRequired = {
  collab: TCollabFrontendExports;
};

type TSpaceExports = {
  registerMenuEntries: (entries: TSpaceMenuEntries) => void;
  registerNodes: (nodes: { [key: string]: FC<{ node: TGraphNode }> }) => void;
  registerLayer: (layers: TLayerProvider) => void;
  registerPanel: (panel: PanelComponent) => void;
};

const menuEntries: TSpaceMenuEntries[] = [];

let nodes: { [key: string]: FC<{ node: TGraphNode }> } = {};

const layers: TLayerProvider[] = [];

export type TPanel = { type: string; uuid: string; data: TJsonObject };

export type PanelComponent = FC<{
  panel: TPanel;
  closePanel: (uuid: string) => void;
}>;

const panels: PanelComponent[] = [];

export const moduleFrontend: TModule<TRequired, TSpaceExports> = {
  name: 'space',
  version: '0.0.1',
  description: 'Space module',
  dependencies: ['core-graph'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'graphViews');

    const exports: TSpaceExports = {
      registerMenuEntries: (entries) => {
        menuEntries.push(entries);
      },
      registerNodes: (newNodes) => {
        nodes = { ...nodes, ...newNodes };
      },
      registerLayer: (newLayer) => {
        layers.push(newLayer);
      },
      registerPanel: (newPanel) => {
        panels.push(newPanel);
      },
    };

    exports.registerMenuEntries(spaceMenuEntries);
    exports.registerNodes({
      group: Group,
      shape: Shape,
    });

    moduleExports(exports);
  },
};
