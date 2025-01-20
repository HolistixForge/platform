import { CSSProperties, FC, useState } from 'react';

import './sidebar.css';
import { Link } from 'react-router-dom';

type SidebarItem = {
  title: string;
  Icon: FC<{ className: string }>;
  onclick?: () => void;
  link?: string;
};

export const Sidebar = ({
  items,
  active: propsActive,
}: {
  items: SidebarItem[];
  active: string;
}) => {
  let i = items.findIndex((item) => item.title === propsActive);
  i = i === -1 ? 0 : i;
  const [active, setActive] = useState<number>(i);

  const style = {
    '--sidebar-active-item': active,
  };

  return (
    <aside className='h-fit'>
      <ul style={style as CSSProperties}>
        {items.map((item, k) => (
          <li
            key={item.title}
            onClick={() => {
              setActive(k);
              item.onclick && item.onclick();
            }}
            title={item.title}
          >
            {item.link ? (
              <Link to={item.link}>
                <item.Icon className={active === k ? 'active' : ''} />
              </Link>
            ) : (
              <item.Icon className={active === k ? 'active' : ''} />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
};
