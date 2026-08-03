import { Children, FC } from 'react';
import { useEffect, useState } from 'react';
import { useRef } from 'react';

//
type ChildProps = { key: string | number };

type Child = ReturnType<FC<ChildProps>>;

interface ServerStackProps {
  children: Child | Child[];
  onNewServerClick: () => void;
}

export const ServerStack = ({
  children,
  onNewServerClick,
}: ServerStackProps) => {
  const [columns, setColumns] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const columns = Math.floor(width / (400 + 32));
      setColumns(columns);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const _children = Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className="server-stack-container grid w-full"
      style={{
        gap: '32px',
        gridTemplateColumns: `repeat(${columns}, minmax(400px, 1fr))`,
      }}
    >
      <div
        className="flex items-center justify-center cursor-pointer"
        style={{
          width: '400px',
          height: '202px',
          borderStyle: 'dashed',
          borderWidth: '1px',
          borderRadius: '8px',
          borderColor: 'rgba(255,255,255,0.4)',
        }}
        onClick={onNewServerClick}
      >
        <p
          className="font-bold"
          style={{ fontSize: '12px', lineHeight: '28px', color: 'white' }}
        >
          add resource
        </p>
      </div>

      {_children.map((child, index) => {
        // Children.toArray() puts a stable key on the element itself;
        // `props.key` is always undefined in React.
        const key = (child as { key?: string | null }).key ?? index;
        return (
          <div key={key} className="flex-1">
            {child}
          </div>
        );
      })}
    </div>
  );
};
