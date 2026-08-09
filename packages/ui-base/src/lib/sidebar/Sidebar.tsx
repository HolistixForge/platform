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

  /**
   * The items, cut into groups.
   *
   * `separatorBefore` marks where a level ends, and the split has to be in
   * the DOM rather than in a border: as an island the groups are separate
   * boxes with air between them, and a rule drawn inside one list cannot
   * become two boxes. As a bar they are one column again, with a rule where
   * the cut is.
   *
   * The index is kept alongside each item because the active mark is held by
   * position in the flat list, and grouping must not renumber it.
   */
  const groups = items.reduce<{ item: SidebarItem; index: number }[][]>(
    (acc, item, index) => {
      if (item.separatorBefore || acc.length === 0) acc.push([]);
      acc[acc.length - 1].push({ item, index });
      return acc;
    },
    // One group to start with, so a rail with nothing in it is still a rail
    // rather than an empty box: the grouping is about where the cuts are, not
    // about whether there is a list at all.
    [[]]
  );

  return (
    // No `h-fit`: the dashboard variant is full height, and the island sizes
    // itself. The active mark is placed by CSS from the `active` class on the
    // icon, so the index no longer has to be published as a custom property
    // for arithmetic to consume.
    <aside className={`sidebar--${variant}`}>
      {groups.map((group, g) => (
        <ul key={group[0]?.item.title ?? g}>
          {group.map(({ item, index }) => (
            <li
              key={item.title}
              className={item.disabled ? 'sidebar-item-disabled' : ''}
              onClick={() => {
                if (item.disabled) return;
                setActive(index);
                item.onclick?.();
              }}
              title={item.label ?? item.title}
              aria-disabled={item.disabled || undefined}
            >
              {item.link && !item.disabled ? (
                <Link to={item.link}>
                  <item.Icon className={active === index ? 'active' : ''} />
                </Link>
              ) : (
                <item.Icon
                  className={active === index && !item.disabled ? 'active' : ''}
                />
              )}
            </li>
          ))}
        </ul>
      ))}
    </aside>
  );
};
