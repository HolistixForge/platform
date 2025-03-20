import { Children, FC } from 'react';

//
type ChildProps = { key: string | number };

type Child = ReturnType<FC<ChildProps>>;

interface ServerStackProps {
  children: Child | Child[];
  onNewServerClick: () => void;
}
import { useEffect, useState } from 'react';
import { useRef } from 'react';

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

    containerRef.current && observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const _children = Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className="server-stack-container grid gap-[32px] w-full"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(400px, 1fr))` }}
    >
      <div
        className="w-[400px] h-[202px] flex items-center justify-center border-dashed border rounded-[8px] border-white/40 cursor-pointer"
        onClick={onNewServerClick}
      >
        <p className="text-[12px] font-bold leading-[28px] text-white">
          add resource
        </p>
      </div>

      {_children.map((child) => {
        const key = (child as { props: ChildProps }).props.key;
        return (
          <div key={key} className="flex-1">
            {child}
          </div>
        );
      })}
    </div>
  );
};
