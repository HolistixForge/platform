import { FC, useMemo } from 'react';
import { TLayerProvider } from '@monorepo/module/frontend';
import { useLayerContext } from '../layer-context';
import { flattenLayerTreeCollection } from '../../layer-tree-utils';

export const LayersTreePanel: FC<{
  providers: TLayerProvider[];
}> = ({ providers }) => {
  const { activeLayerId, activeLayerPayload, activateLayer, treeCollection } =
    useLayerContext();

  // Flatten tree items for rendering
  const flattenedItems = useMemo(() => {
    if (!treeCollection) return [];
    return flattenLayerTreeCollection(treeCollection, activeLayerId);
  }, [treeCollection, activeLayerId]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '8px 0' }}>Layers & Nodes</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {flattenedItems.map((item) => {
          const isActiveLayer =
            item.type === 'layer' && item.id === activeLayerId;
          const isClickable = item.type === 'layer' && item.id === 'reactflow';
          const indent = item.level * 16; // Indent based on level

          // Check if this node is being edited (matches activeLayerPayload.nodeId)
          const isBeingEdited =
            item.type === 'node' &&
            activeLayerPayload?.nodeId &&
            item.id === activeLayerPayload.nodeId;

          // Determine if this item belongs to the active layer
          const belongsToActiveLayer = item.layerId === activeLayerId;

          // Style based on active state
          const getItemStyle = () => {
            if (isActiveLayer) {
              // Active layer header - bright and colorful
              return {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              };
            } else if (isBeingEdited) {
              // Node being edited - same style as active layer
              return {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              };
            } else if (belongsToActiveLayer) {
              // Items in active layer - colorful but less intense
              return {
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                fontWeight: 500,
                boxShadow: '0 1px 4px rgba(240, 147, 251, 0.3)',
              };
            } else {
              // Inactive layer items - grey and muted
              return {
                background: 'transparent',
                color:
                  item.type === 'layer' && item.id !== 'reactflow'
                    ? 'var(--color-text-disabled, #9ca3af)'
                    : 'var(--color-text-secondary, #6b7280)',
                fontWeight: item.type === 'layer' ? 400 : 300,
                opacity:
                  item.type === 'layer' && item.id !== 'reactflow' ? 0.4 : 0.7,
              };
            }
          };

          const itemStyle = getItemStyle();

          return (
            <div
              key={item.id}
              onClick={isClickable ? () => activateLayer(item.id) : undefined}
              style={{
                padding: '6px 12px',
                marginLeft: `${indent}px`,
                marginBottom: '2px',
                cursor: isClickable ? 'pointer' : 'default',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                fontSize: item.type === 'layer' ? '14px' : '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                ...itemStyle,
              }}
            >
              {/* Icon based on type */}
              <span style={{ fontSize: '10px' }}>
                {item.type === 'layer'
                  ? '📁'
                  : item.type === 'group'
                  ? '📦'
                  : '🔹'}
              </span>

              {/* Title */}
              <span>{item.title}</span>

              {/* Status indicators */}
              {item.locked && (
                <span
                  style={{ fontSize: '10px' }}
                  role="img"
                  aria-label="locked"
                >
                  🔒
                </span>
              )}
              {!item.visible && (
                <span
                  style={{ fontSize: '10px' }}
                  role="img"
                  aria-label="hidden"
                >
                  👁️‍🗨️
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
