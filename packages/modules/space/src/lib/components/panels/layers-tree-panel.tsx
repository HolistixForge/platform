import { FC, useMemo } from 'react';
import { TLayerProvider } from '@monorepo/module/frontend';

export const LayersTreePanel: FC<{
  providers: TLayerProvider[];
  activateLayer: (layerId: string) => void;
  activeLayerId: string | null;
}> = ({ providers, activateLayer, activeLayerId }) => {
  const items = useMemo(() => {
    const baseline = [{ id: 'reactflow', title: 'Base layer' }];
    const moduleItems = providers.map((p) => ({ id: p.id, title: p.title }));
    return [...baseline, ...moduleItems];
  }, [providers]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: '8px 0' }}>Layers</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it) => (
          <li
            key={it.id}
            onClick={() => activateLayer(it.id)}
            style={{
              padding: '6px 4px',
              borderBottom: '1px solid var(--color-border, #eee)',
              cursor: 'pointer',
            }}
            className={it.id === activeLayerId ? 'active' : ''}
          >
            {it.title}
          </li>
        ))}
      </ul>
    </div>
  );
};
