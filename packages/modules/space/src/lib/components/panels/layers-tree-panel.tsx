import { FC, useMemo } from 'react';
import { TLayerProvider } from '@monorepo/module/frontend';
import { useLayerContext } from '../layer-context';

export const LayersTreePanel: FC<{
  providers: TLayerProvider[];
}> = ({ providers }) => {
  const { activeLayerId, activateLayer } = useLayerContext();
  const items = useMemo(() => {
    const baseline = [{ id: 'reactflow', title: 'Base layer' }];
    const moduleItems = providers.map((p) => ({ id: p.id, title: p.title }));
    return [...baseline, ...moduleItems];
  }, [providers]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '8px 0' }}>Layers</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it) => {
          const isActive = it.id === activeLayerId;
          const isClickable = it.id === 'reactflow';
          return (
            <li
              key={it.id}
              onClick={isClickable ? () => activateLayer(it.id) : undefined}
              style={{
                padding: '6px 4px',
                cursor: isClickable ? 'pointer' : 'not-allowed',
                background: isActive
                  ? 'var(--color-primary, #e0e7ff)'
                  : 'transparent',
                color: isActive
                  ? 'var(--color-primary-contrast, #1e293b)'
                  : isClickable
                  ? 'inherit'
                  : 'var(--color-text-disabled, #9ca3af)',
                fontWeight: isActive ? 600 : 400,
                borderRadius: isActive ? '4px' : undefined,
                transition: 'background 0.15s, color 0.15s',
                opacity: isClickable ? 1 : 0.6,
              }}
            >
              {it.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
