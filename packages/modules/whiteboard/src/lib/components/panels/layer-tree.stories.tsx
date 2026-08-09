import type { Meta, StoryObj } from '@storybook/react';

import { LayerTree } from './layer-tree';
import { TLayerTreeCollection, TLayerTreeItem } from '../../layer-tree-types';

//

const node = (
  id: string,
  title: string,
  over: Partial<TLayerTreeItem> = {}
): TLayerTreeItem => ({
  id,
  type: 'node',
  title,
  level: 1,
  visible: true,
  expanded: true,
  locked: false,
  layerId: 'excalidraw',
  ...over,
});

const group = (
  id: string,
  title: string,
  children: TLayerTreeItem[]
): TLayerTreeItem => ({
  ...node(id, title),
  type: 'group',
  children,
});

/** A board with some drawing on it and a couple of live nodes. */
const board: TLayerTreeCollection = {
  layers: [
    {
      layerId: 'excalidraw',
      title: 'Excalidraw',
      items: [
        node('n-notebook', 'notebook'),
        node('n-terminal', 'terminal', { locked: true }),
        group('g-flow', 'Ingestion', [
          node('e-rect-1', 'Rectangle 1'),
          node('e-arrow-1', 'Arrow 2'),
          node('e-text-1', 'label', { visible: false }),
        ]),
        node('e-rect-2', 'Rectangle 4'),
      ],
    },
    {
      layerId: 'reactflow',
      title: 'Base layer',
      items: [node('n-user', 'user-container', { layerId: 'reactflow' })],
    },
  ],
};

//

const meta = {
  title: 'Modules/Whiteboard/Panels/LayerTree',
  component: LayerTree,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The board’s contents. Presentational: it takes a collection and ' +
          'hands back clicks. No eye and no padlock — the board’s tree ' +
          'operations are a stub, and a control that does nothing is worse ' +
          'than one that is not there.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: '260px',
          padding: '12px',
          background: 'var(--color-bg-app)',
          borderRadius: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LayerTree>;

export default meta;

type Story = StoryObj<typeof LayerTree>;

export const Board: Story = {
  args: { collection: board, activeLayerId: 'excalidraw' },
};

/** Everything below the active layer is dimmed, not hidden. */
export const OtherLayerActive: Story = {
  args: { collection: board, activeLayerId: 'reactflow' },
};

/** The one filled row: it answers "where is the thing I clicked". */
export const WithSelection: Story = {
  args: {
    collection: board,
    activeLayerId: 'excalidraw',
    selectedIds: ['e-arrow-1'],
  },
};

/** Locked and hidden are shown where they are true, and only shown. */
export const Flags: Story = {
  args: {
    collection: {
      layers: [
        {
          layerId: 'excalidraw',
          title: 'Excalidraw',
          items: [
            node('a', 'ordinary'),
            node('b', 'locked', { locked: true }),
            node('c', 'hidden', { visible: false }),
            node('d', 'both', { locked: true, visible: false }),
          ],
        },
      ],
    },
    activeLayerId: 'excalidraw',
  },
};

/** A board nobody has drawn on yet. */
export const Empty: Story = {
  args: {
    collection: {
      layers: [{ layerId: 'excalidraw', title: 'Excalidraw', items: [] }],
    },
    activeLayerId: 'excalidraw',
  },
};

/** Deep enough to show what the indent is for. */
export const Nested: Story = {
  args: {
    collection: {
      layers: [
        {
          layerId: 'excalidraw',
          title: 'Excalidraw',
          items: [
            group('g1', 'Pipeline', [
              node('g1a', 'source'),
              group('g2', 'Transforms', [
                node('g2a', 'clean'),
                group('g3', 'Joins', [node('g3a', 'left join')]),
              ]),
            ]),
          ],
        },
      ],
    },
    activeLayerId: 'excalidraw',
  },
};
