import { SimpleEdge, Node } from './graph-logic';

/**
 *
 */

export const initialNodes: Node[] = [
  {
    id: 'node-0',
    type: 'NodeVault',
    data: { id: 'node-0' },
    position: { x: 500, y: 100 },
  },
  {
    id: 'node-1',
    type: 'NodePython',
    data: { id: 'node-1' },
    position: { x: 200, y: 450 },
  },
  {
    id: 'node-2',
    type: 'NodeScreening',
    data: { id: 'node-2' },
    position: { x: 400, y: 800 },
  },
  {
    id: 'node-3',
    type: 'custom-node',
    data: { id: 'node-3' },
    position: { x: 100, y: 900 },
  },
  {
    id: 'node-4',
    type: 'NodeDataset',
    data: { id: 'node-4' },
    position: { x: 150, y: 50 },
  },
  {
    id: 'node-5',
    type: 'NodeChat',
    data: { id: 'node-5' },
    position: { x: 350, y: 250 },
  },
  {
    id: 'node-6',
    type: 'NodeImage',
    data: { id: 'node-6', url: 'https://' },
    position: { x: 1000, y: 400 },
  }
];

/**
 *
 */

export const initialEdges: SimpleEdge[] = [
  {
    id: '0:2-1:4',
    source: 'node-0',
    target: 'node-1',
    sourceHandle: 'handle_source_2',
    targetHandle: 'handle_target_4',
    data: { type: 'simple' },
  },
  {
    id: '0:8-1:4',
    source: 'node-0',
    target: 'node-1',
    sourceHandle: 'handle_source_8',
    targetHandle: 'handle_target_4',
    data: { type: 'simple' },
  },
  {
    id: '0:5-1:8',
    source: 'node-0',
    target: 'node-1',
    sourceHandle: 'handle_source_5',
    targetHandle: 'handle_target_0',
    data: { type: 'simple' },
  },
  {
    id: '1:7-2:6',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'handle_source_7',
    targetHandle: 'handle_target_6',
    data: { type: 'simple' },
  },
  {
    id: '1:3-2:8',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'handle_source_3',
    targetHandle: 'handle_target_8',
    data: { type: 'simple' },
  },
  {
    id: '1:3-3:8',
    source: 'node-1',
    target: 'node-3',
    sourceHandle: 'handle_source_3',
    targetHandle: 'handle_target_8',
    data: { type: 'simple' },
  },
  {
    id: '1:1-3:8',
    source: 'node-1',
    target: 'node-3',
    sourceHandle: 'handle_source_1',
    targetHandle: 'handle_target_8',
    data: { type: 'simple' },
  },
  {
    id: '1:5-3:2',
    source: 'node-1',
    target: 'node-3',
    sourceHandle: 'handle_source_5',
    targetHandle: 'handle_target_2',
    data: { type: 'simple' },
  },
  {
    id: '4:5-1:2',
    source: 'node-4',
    target: 'node-1',
    sourceHandle: 'handle_source_5',
    targetHandle: 'handle_target_2',
    data: { type: 'simple' },
  },
  {
    id: '4:0-1:9',
    source: 'node-4',
    target: 'node-1',
    sourceHandle: 'handle_source_0',
    targetHandle: 'handle_target_9',
    data: { type: 'simple' },
  },
];
