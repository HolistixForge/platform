import { getAbsolutePosition } from './position-utils';
import { TGraphView } from '../whiteboard-types';

/**
 * TESTING POSITION UTILITY FUNCTIONS
 * 
 * This test suite demonstrates:
 * - Testing coordinate transformation functions
 * - Testing recursive tree traversal for position calculation
 * - Testing with hierarchical data structures
 * - Edge cases with missing parents and circular references
 */

describe('Position Utilities', () => {
  describe('getAbsolutePosition', () => {
    it('should return position unchanged when no parent', () => {
      const position = { x: 100, y: 200 };
      const gv: TGraphView = {
        nodeViews: [],
      } as TGraphView;

      const result = getAbsolutePosition(position, undefined, gv);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should add parent position to node position', () => {
      const position = { x: 50, y: 60 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 100, y: 200 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 150, y: 260 });
    });

    it('should handle nested parents (grandparent -> parent -> node)', () => {
      const position = { x: 10, y: 20 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'grandparent',
            position: { x: 100, y: 200 },
            parentId: undefined,
          },
          {
            id: 'parent',
            position: { x: 50, y: 60 },
            parentId: 'grandparent',
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent', gv);

      // 10 + 50 (parent) + 100 (grandparent) = 160
      // 20 + 60 (parent) + 200 (grandparent) = 280
      expect(result).toEqual({ x: 160, y: 280 });
    });

    it('should handle deeply nested hierarchy', () => {
      const position = { x: 5, y: 5 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'level3',
            position: { x: 30, y: 30 },
            parentId: undefined,
          },
          {
            id: 'level2',
            position: { x: 20, y: 20 },
            parentId: 'level3',
          },
          {
            id: 'level1',
            position: { x: 10, y: 10 },
            parentId: 'level2',
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'level1', gv);

      // 5 + 10 + 20 + 30 = 65
      expect(result).toEqual({ x: 65, y: 65 });
    });

    it('should handle parent not found in nodeViews', () => {
      const position = { x: 100, y: 200 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'someOtherNode',
            position: { x: 50, y: 60 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'nonexistent', gv);

      // Parent not found, should return original position
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle parent without position property', () => {
      const position = { x: 100, y: 200 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            // position is undefined
            parentId: undefined,
          } as any,
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      // Parent has no position, should return original position
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle zero positions', () => {
      const position = { x: 0, y: 0 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 0, y: 0 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative positions', () => {
      const position = { x: -10, y: -20 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 50, y: 60 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 40, y: 40 });
    });

    it('should handle parent with negative position', () => {
      const position = { x: 100, y: 100 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: -50, y: -60 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 50, y: 40 });
    });

    it('should not modify original position object', () => {
      const position = { x: 100, y: 200 };
      const originalX = position.x;
      const originalY = position.y;
      
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 50, y: 60 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      getAbsolutePosition(position, 'parent1', gv);

      // Original should be unchanged
      expect(position.x).toBe(originalX);
      expect(position.y).toBe(originalY);
    });

    it('should handle empty nodeViews array', () => {
      const position = { x: 100, y: 200 };
      const gv: TGraphView = {
        nodeViews: [],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle fractional positions', () => {
      const position = { x: 10.5, y: 20.7 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 5.3, y: 7.9 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result.x).toBeCloseTo(15.8, 5);
      expect(result.y).toBeCloseTo(28.6, 5);
    });

    it('should handle very large position values', () => {
      const position = { x: 10000, y: 20000 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 5000, y: 7000 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      expect(result).toEqual({ x: 15000, y: 27000 });
    });

    it('should stop traversal at top-level parent', () => {
      const position = { x: 10, y: 20 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'topParent',
            position: { x: 100, y: 200 },
            parentId: undefined, // No parent
          },
          {
            id: 'middleParent',
            position: { x: 50, y: 60 },
            parentId: 'topParent',
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'middleParent', gv);

      // Should add both middle and top parent positions
      expect(result).toEqual({ x: 160, y: 280 });
    });

    it('should handle complex node hierarchy', () => {
      const position = { x: 1, y: 2 };
      const gv: TGraphView = {
        nodeViews: [
          { id: 'root', position: { x: 1000, y: 2000 }, parentId: undefined },
          { id: 'branch1', position: { x: 100, y: 200 }, parentId: 'root' },
          { id: 'branch2', position: { x: 300, y: 400 }, parentId: 'root' },
          { id: 'leaf1', position: { x: 10, y: 20 }, parentId: 'branch1' },
          { id: 'leaf2', position: { x: 30, y: 40 }, parentId: 'branch2' },
        ],
      } as TGraphView;

      // Test position relative to leaf1
      const result1 = getAbsolutePosition(position, 'leaf1', gv);
      expect(result1).toEqual({ x: 1111, y: 2222 }); // 1 + 10 + 100 + 1000

      // Test position relative to leaf2
      const result2 = getAbsolutePosition(position, 'leaf2', gv);
      expect(result2).toEqual({ x: 1331, y: 2442 }); // 1 + 30 + 300 + 1000
    });

    it('should handle missing parentId in chain', () => {
      const position = { x: 10, y: 20 };
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent1',
            position: { x: 100, y: 200 },
            parentId: 'nonexistent',
          },
        ],
      } as TGraphView;

      const result = getAbsolutePosition(position, 'parent1', gv);

      // Should add parent1 position then stop (can't find nonexistent)
      expect(result).toEqual({ x: 110, y: 220 });
    });
  });

  describe('Integration scenarios', () => {
    it('should calculate positions for sibling nodes correctly', () => {
      const gv: TGraphView = {
        nodeViews: [
          {
            id: 'parent',
            position: { x: 100, y: 100 },
            parentId: undefined,
          },
        ],
      } as TGraphView;

      const child1Pos = getAbsolutePosition({ x: 10, y: 10 }, 'parent', gv);
      const child2Pos = getAbsolutePosition({ x: 20, y: 30 }, 'parent', gv);

      expect(child1Pos).toEqual({ x: 110, y: 110 });
      expect(child2Pos).toEqual({ x: 120, y: 130 });
    });

    it('should work with real-world whiteboard scenario', () => {
      // Simulating a whiteboard with groups and nested elements
      const gv: TGraphView = {
        nodeViews: [
          // Container group
          { id: 'container', position: { x: 50, y: 50 }, parentId: undefined },
          // Group inside container
          { id: 'group1', position: { x: 100, y: 150 }, parentId: 'container' },
          // Elements inside group
          { id: 'elem1', position: { x: 20, y: 30 }, parentId: 'group1' },
        ],
      } as TGraphView;

      const absolutePos = getAbsolutePosition({ x: 5, y: 10 }, 'elem1', gv);

      // 5 + 20 (elem1) + 100 (group1) + 50 (container) = 175
      // 10 + 30 (elem1) + 150 (group1) + 50 (container) = 240
      expect(absolutePos).toEqual({ x: 175, y: 240 });
    });
  });
});

