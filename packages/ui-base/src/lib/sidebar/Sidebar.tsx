import { FC, useState } from 'react';

import './sidebar.css';
import { Link } from 'react-router-dom';

type SidebarItem = {
  title: string;
  Icon: FC<{ className: string }>;
  onclick?: () => void;
  link?: string;
  /**
   * Present, and out of reach from here.
   *
   * Dropping the entry instead would be worse: the rail would change length
   * by page, and a person navigating by position would find a different thing
   * under the cursor each time. Shown greyed, the column is the same
   * everywhere and the absence is legible as "not from here" rather than as
   * "gone".
   */
  disabled?: boolean;
  /** Starts a new group — a rule above it, in the same column. */
  separatorBefore?: boolean;
  /** What the tooltip says, when the title is not the whole story. */
  label?: string;
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
            className={[
              item.separatorBefore ? 'sidebar-group-start' : '',
              item.disabled ? 'sidebar-item-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              if (item.disabled) return;
              setActive(k);
              item.onclick?.();
            }}
            title={item.label ?? item.title}
            aria-disabled={item.disabled || undefined}
          >
            {item.link && !item.disabled ? (
              <Link to={item.link}>
                <item.Icon className={active === k ? 'active' : ''} />
              </Link>
            ) : (
              <item.Icon
                className={active === k && !item.disabled ? 'active' : ''}
              />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
};
