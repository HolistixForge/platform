import { FC, useState } from 'react';

import './sidebar.css';
import { Link } from 'react-router-dom';

type SidebarItem = {
  title: string;
  Icon: FC<{ className: string }>;
  onclick?: () => void;
  link?: string;
};

/**
 * How the rail is placed.
 *
 * `dashboard` — a vertical bar docked to the left edge, full height. The page
 * indents past it, so the rail owns a column rather than covering one.
 *
 * `island` — a floating rounded box, vertically centred, over the content.
 */
export type SidebarVariant = 'dashboard' | 'island';

export const Sidebar = ({
  items,
  active: propsActive,
  variant = 'dashboard',
}: {
  items: SidebarItem[];
  active: string;
  variant?: SidebarVariant;
}) => {
  let i = items.findIndex((item) => item.title === propsActive);
  i = i === -1 ? 0 : i;
  const [active, setActive] = useState<number>(i);

  return (
    // No `h-fit`: the dashboard variant is full height, and the island sizes
    // itself. The active mark is placed by CSS from the `active` class on the
    // icon, so the index no longer has to be published as a custom property
    // for arithmetic to consume.
    <aside className={`sidebar--${variant}`}>
      <ul>
        {items.map((item, k) => (
          <li
            key={item.title}
            onClick={() => {
              setActive(k);
              item.onclick?.();
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
