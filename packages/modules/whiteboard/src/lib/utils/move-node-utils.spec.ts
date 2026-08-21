import { getDescendants, resolveNodeMove } from './move-node-utils';
import { TGraphView, TNodeView } from '../whiteboard-types';

/**
 * TESTING NODE MOVE RESOLUTION
 *
 * `resolveNodeMove` decides where a dragged node lands and which group it ends
 * up in. It is shared by the reducer and by the frontend's optimistic override,
 * so both ends of a drag agree on whether a position is relative to a group or
 * absolute — a disagreement there is what made grouped nodes jump between stale
 * positions mid-drag.
 */

const nodeView = (n: Partial<TNodeView> & { id: string }): TNodeView => ({
  type: 'node',
  position: { x: 0, y: 0 },
  status: {
    mode: 'EXPANDED',
    forceOpened: false,
    forceClosed: false,
    isFiltered: false,
    rank: 0,
    maxRank: 1,
  },
  ...n,
});

const graphView = (nodeViews: TNodeView[]): TGraphView =>
  ({
    nodeViews,
    graph: { nodes: nodeViews, edges: [] },
  } as unknown as TGraphView);

describe('move-node-utils', () => {
  describe('getDescendants', () => {
    it('should collect children recursively', () => {
      const gv = graphView([
        nodeView({ id: 'group' }),
        nodeView({ id: 'inner', parentId: 'group' }),
        nodeView({ id: 'leaf', parentId: 'inner' }),
        nodeView({ id: 'unrelated' }),
      ]);

      expect(getDescendants('group', gv)).toEqual(new Set(['inner', 'leaf']));
    });

    it('should return an empty set for a node without children', () => {
      const gv = graphView([nodeView({ id: 'alone' })]);

      expect(getDescendants('alone', gv)).toEqual(new Set());
    });

    it('should terminate on a cyclic hierarchy', () => {
      const gv = graphView([
        nodeView({ id: 'a', parentId: 'b' }),
        nodeView({ id: 'b', parentId: 'a' }),
      ]);

      expect(getDescendants('a', gv)).toEqual(new Set(['b', 'a']));
    });
  });

  describe('resolveNodeMove during a drag', () => {
    it('should keep a free node position untouched', () => {
      const gv = graphView([nodeView({ id: 'card' })]);
      const card = gv.nodeViews[0];

      expect(resolveNodeMove(gv, card, { x: 30, y: 40 }, false)).toEqual({
        position: { x: 30, y: 40 },
        parentId: undefined,
      });
    });

    it('should keep a grouped node in its group without converting its position', () => {
      // This is the regression: the position React Flow reports for a child is
      // relative to its group, so re-parenting it mid-drag (and treating that
      // relative position as absolute) teleported it near the canvas origin.
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 400, height: 400 },
        }),
        nodeView({ id: 'card', parentId: 'group', position: { x: 10, y: 10 } }),
      ]);
      const card = gv.nodeViews[1];

      expect(resolveNodeMove(gv, card, { x: 60, y: 70 }, false)).toEqual({
        position: { x: 60, y: 70 },
        parentId: 'group',
      });
    });

    it('should be idempotent when the same event is replayed', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 400, height: 400 },
        }),
        nodeView({ id: 'card', parentId: 'group', position: { x: 10, y: 10 } }),
      ]);
      const card = gv.nodeViews[1];

      const first = resolveNodeMove(gv, card, { x: 60, y: 70 }, false);
      card.position = first.position;
      card.parentId = first.parentId;

      // The override replays the last event on every push from the backend.
      expect(resolveNodeMove(gv, card, { x: 60, y: 70 }, false)).toEqual(first);
    });
  });

  describe('resolveNodeMove at drag stop', () => {
    it('should keep a node dropped outside any group absolute', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 100, height: 100 },
        }),
        nodeView({ id: 'card', position: { x: 20, y: 20 } }),
      ]);
      const card = gv.nodeViews[1];

      expect(resolveNodeMove(gv, card, { x: 10, y: 10 }, true)).toEqual({
        position: { x: 10, y: 10 },
        parentId: undefined,
      });
    });

    it('should attach a node dropped inside a group with a relative position', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 400, height: 400 },
        }),
        nodeView({ id: 'card', position: { x: 20, y: 20 } }),
      ]);
      const card = gv.nodeViews[1];

      expect(resolveNodeMove(gv, card, { x: 550, y: 560 }, true)).toEqual({
        position: { x: 50, y: 60 },
        parentId: 'group',
      });
    });

    it('should convert a grouped node position to absolute before testing groups', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 400, height: 400 },
        }),
        nodeView({ id: 'card', parentId: 'group', position: { x: 10, y: 10 } }),
      ]);
      const card = gv.nodeViews[1];

      // Still inside its own group: stays attached, position unchanged.
      expect(resolveNodeMove(gv, card, { x: 60, y: 70 }, true)).toEqual({
        position: { x: 60, y: 70 },
        parentId: 'group',
      });
    });

    it('should detach a node dragged out of its group', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 100, height: 100 },
        }),
        nodeView({ id: 'card', parentId: 'group', position: { x: 10, y: 10 } }),
      ]);
      const card = gv.nodeViews[1];

      // 300 past the group's 100x100 box.
      expect(resolveNodeMove(gv, card, { x: 300, y: 300 }, true)).toEqual({
        position: { x: 800, y: 800 },
        parentId: undefined,
      });
    });

    it('should pick the smallest containing group', () => {
      const gv = graphView([
        nodeView({
          id: 'outer',
          type: 'group',
          position: { x: 0, y: 0 },
          size: { width: 1000, height: 1000 },
        }),
        nodeView({
          id: 'inner',
          type: 'group',
          position: { x: 100, y: 100 },
          size: { width: 200, height: 200 },
        }),
        nodeView({ id: 'card', position: { x: 0, y: 0 } }),
      ]);
      const card = gv.nodeViews[2];

      expect(resolveNodeMove(gv, card, { x: 150, y: 150 }, true)).toEqual({
        position: { x: 50, y: 50 },
        parentId: 'inner',
      });
    });

    it('should not drop a group into one of its own descendants', () => {
      const gv = graphView([
        nodeView({
          id: 'outer',
          type: 'group',
          position: { x: 0, y: 0 },
          size: { width: 1000, height: 1000 },
        }),
        nodeView({
          id: 'inner',
          type: 'group',
          parentId: 'outer',
          position: { x: 100, y: 100 },
          size: { width: 200, height: 200 },
        }),
      ]);
      const outer = gv.nodeViews[0];

      expect(resolveNodeMove(gv, outer, { x: 150, y: 150 }, true)).toEqual({
        position: { x: 150, y: 150 },
        parentId: undefined,
      });
    });

    it('should leave a node with grouping disabled ungrouped', () => {
      const gv = graphView([
        nodeView({
          id: 'group',
          type: 'group',
          position: { x: 500, y: 500 },
          size: { width: 400, height: 400 },
        }),
        nodeView({
          id: 'drawing',
          position: { x: 0, y: 0 },
          disabledFeatures: ['grouping'],
        }),
      ]);
      const drawing = gv.nodeViews[1];

      expect(resolveNodeMove(gv, drawing, { x: 550, y: 560 }, true)).toEqual({
        position: { x: 550, y: 560 },
        parentId: undefined,
      });
    });

    it('should ignore a group with no size', () => {
      const gv = graphView([
        nodeView({ id: 'group', type: 'group', position: { x: 0, y: 0 } }),
        nodeView({ id: 'card', position: { x: 0, y: 0 } }),
      ]);
      const card = gv.nodeViews[1];

      expect(resolveNodeMove(gv, card, { x: 10, y: 10 }, true)).toEqual({
        position: { x: 10, y: 10 },
        parentId: undefined,
      });
    });

    it('should resolve a nested group box against its own parent', () => {
      const gv = graphView([
        nodeView({
          id: 'outer',
          type: 'group',
          position: { x: 1000, y: 1000 },
          size: { width: 500, height: 500 },
        }),
        nodeView({
          id: 'inner',
          type: 'group',
          parentId: 'outer',
          position: { x: 100, y: 100 },
          size: { width: 100, height: 100 },
        }),
        nodeView({ id: 'card', position: { x: 0, y: 0 } }),
      ]);
      const card = gv.nodeViews[2];

      // Absolute (1150, 1150) is inside `inner`, which sits at (1100, 1100).
      expect(resolveNodeMove(gv, card, { x: 1150, y: 1150 }, true)).toEqual({
        position: { x: 50, y: 50 },
        parentId: 'inner',
      });
    });
  });
});
