import {
  Children,
  FC,
  createRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CSSTransition } from 'react-transition-group';
import * as Tabs from '@radix-ui/react-tabs';
import { icons } from '@holistix-forge/ui-base';
import { ReadOnlyTree, TreeElement } from '../tree';

import './tabs-radix.scss';

const SEPARATOR = '#>-.-<#';

//
//

const Trigger = ({
  title,
  panelId,
  active,
  childrenCount,
  onDelete,
  onTabRowAdd,
  onRename,
}: {
  title: string;
  panelId: string;
  active: boolean;
  childrenCount: number;
  onDelete: () => void;
  onTabRowAdd?: () => void;
  onRename: (name: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState<string>('');

  const handleChange = useCallback((e: React.FormEvent) => {
    const value = (e.target as HTMLSpanElement).innerText;
    setNewTitle(value);
  }, []);

  const rename = () => {
    if (newTitle !== '') {
      onRename(newTitle);
    }
    setNewTitle('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      rename();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditing) {
      setIsEditing(true);
      const callback = (e2: MouseEvent) => {
        if (e2.target !== e.target) {
          rename();
          document.removeEventListener('click', callback);
        }
      };
      document.addEventListener('click', callback);
    }
  };

  //
  const terminal = childrenCount === 0;

  return (
    <Tabs.Trigger className="TabsTrigger" value={panelId}>
      <div
        className={
          active
            ? terminal
              ? 'trigger-terminal'
              : 'trigger-active'
            : 'trigger-non-active'
        }
      >
        {active && terminal && onTabRowAdd && (
          <div className="icon-add">
            <icons.Plus onClick={onTabRowAdd} />
          </div>
        )}
        <span
          ref={(e: HTMLSpanElement) => {
            if (e && !isEditing) e.innerText = title;
          }}
          role="textbox"
          className={isEditing ? 'editing' : ''}
          onInput={handleChange}
          onKeyDown={handleKeyDown}
          contentEditable={isEditing}
          onDoubleClick={handleDoubleClick}
          onBlur={rename}
        />
        {!terminal && <span className="children-count">{childrenCount}</span>}
        {active && <icons.Close onClick={onDelete} className="icon-close" />}
      </div>
    </Tabs.Trigger>
  );
};

//
//
//

type TabRowProps = {
  activeTitle: string;
  levelPath: string[];
  tabs: TreeElement[];
} & Pick<
  TabsRadixProps,
  'onTabAdd' | 'onTabDelete' | 'onTabRowAdd' | 'onTabRename'
>;

const TabRow = ({
  activeTitle,
  levelPath,
  tabs,
  onTabDelete,
  onTabRowAdd,
  onTabRename,
  onTabAdd,
}: TabRowProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const triggerItems = useMemo(() => {
    return tabs.map((t) => {
      // make this tab absolute path by geting the path from
      // root to this level and appending the tab title
      const triggerPath = [...levelPath, t.title];
      const panelId = triggerPath.join(SEPARATOR);
      return { t, triggerPath, panelId };
    });
  }, [levelPath, tabs]);

  const recomputeOverflow = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth > 1;
    setHasOverflow(overflow);
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollByAmount = useCallback((direction: 'left' | 'right') => {
    const el = listRef.current;
    if (!el) return;
    const amount = Math.max(140, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  useLayoutEffect(() => {
    recomputeOverflow();
  }, [recomputeOverflow, triggerItems.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    recomputeOverflow();

    const onScroll = () => recomputeOverflow();
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => recomputeOverflow());
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [recomputeOverflow]);

  useEffect(() => {
    if (!hasOverflow) setOverflowOpen(false);
  }, [hasOverflow]);

  useEffect(() => {
    if (!overflowOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      )
        return;
      setOverflowOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [overflowOpen]);

  // Keep the active tab visible when selection changes
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>(
      '.TabsTrigger[data-state="active"]'
    );
    activeEl?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeTitle, triggerItems.length, levelPath.join(SEPARATOR)]);

  return (
    <div className="TabsRow" data-overflow={hasOverflow ? 'true' : 'false'}>
      {hasOverflow && (
        <button
          type="button"
          className="TabsScrollButton TabsScrollButtonLeft"
          onClick={() => scrollByAmount('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
        >
          ‹
        </button>
      )}

      <Tabs.List
        key={levelPath.join(SEPARATOR)}
        className="TabsList"
        aria-label="Select space"
        ref={listRef}
      >
        {triggerItems.map(({ t, triggerPath, panelId }) => {
          return (
            <Trigger
              key={panelId}
              childrenCount={t.children.length}
              active={activeTitle === t.title}
              title={t.title}
              panelId={panelId}
              onDelete={() => onTabDelete?.(triggerPath)}
              onTabRowAdd={
                onTabRowAdd ? () => onTabRowAdd?.(triggerPath) : undefined
              }
              onRename={(name: string) => onTabRename?.(triggerPath, name)}
            />
          );
        })}
      </Tabs.List>

      <div className="TabsRowActions">
        <div className="line" />
        <button
          type="button"
          className="TabsAddButton"
          onClick={() => onTabAdd?.(levelPath)}
          aria-label="Add tab"
        >
          <icons.Plus className="add" />
        </button>

        {hasOverflow && (
          <button
            ref={menuButtonRef}
            type="button"
            className="TabsOverflowButton"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-label="More tabs"
            aria-expanded={overflowOpen}
          >
            …
          </button>
        )}

        {hasOverflow && overflowOpen && (
          <div ref={menuRef} className="TabsOverflowMenu" role="menu">
            {triggerItems.map(({ t, panelId }) => (
              <Tabs.Trigger
                key={`overflow-${panelId}`}
                className="TabsOverflowItem"
                value={panelId}
                role="menuitem"
                onClick={() => setOverflowOpen(false)}
              >
                <span className="TabsOverflowItemTitle">{t.title}</span>
                {t.children.length > 0 && (
                  <span className="TabsOverflowItemCount">
                    {t.children.length}
                  </span>
                )}
              </Tabs.Trigger>
            ))}
          </div>
        )}
      </div>

      {hasOverflow && (
        <button
          type="button"
          className="TabsScrollButton TabsScrollButtonRight"
          onClick={() => scrollByAmount('right')}
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
        >
          ›
        </button>
      )}
    </div>
  );
};

//
//
//

export type PanelProps = { tabPath: string[] };

//

type Child = ReturnType<FC<PanelProps>>;

//

export type TabsRadixProps = {
  tree: ReadOnlyTree;
  active: string[];
  children: Child | Child[];
  maxRow: number;
  onTabChange: (path: string[]) => void;
  onTabAdd?: (path: string[]) => void;
  onTabRename?: (path: string[], newName: string) => void;
  onTabDelete?: (path: string[]) => void;
  onTabRowAdd?: (path: string[]) => void;
  hidden?: boolean;
};

//
//

export const TabsRadix = ({
  tree,
  active,
  children,
  maxRow,
  onTabChange,
  onTabAdd,
  onTabRename,
  onTabDelete,
  onTabRowAdd,
  hidden,
}: TabsRadixProps) => {
  const refs = useMemo(
    () =>
      Array(maxRow)
        .fill(1)
        .map((_, i) => createRef<HTMLDivElement>()),
    [maxRow]
  );

  const _children = Children.toArray(children);

  // if the selected path has children itself, we must display the next level of tabs
  // so we push any value at the end of array to force next level to render.
  const renderDepth = [...active];
  const selectedElt = tree.get(active, active.length);

  const isSelectedTerminal = selectedElt && selectedElt?.children.length === 0;
  if (!isSelectedTerminal) renderDepth.push('');

  return (
    <Tabs.Root
      className="TabsRoot"
      defaultValue="tab1"
      value={active.join(SEPARATOR)}
      onValueChange={(s) => {
        onTabChange(s.split(SEPARATOR));
      }}
    >
      {_children.map((child) => {
        const { tabPath } = (child as { props: PanelProps }).props;
        const id = tabPath.join(SEPARATOR);
        return (
          <Tabs.Content
            key={id}
            className="TabsContent"
            value={id}
            forceMount={true}
          >
            {child}
          </Tabs.Content>
        );
      })}

      {!isSelectedTerminal && <div className="TabsContent" />}

      {!hidden &&
        refs.map((ref, depth) => {
          const exists = depth < renderDepth.length;
          const elt = tree.get(active, depth);
          const copy = [...active];
          copy.splice(depth);
          const levelPath = copy;
          return (
            <CSSTransition
              key={depth}
              in={exists}
              nodeRef={ref}
              timeout={300}
              classNames="tab-row-anim"
              unmountOnExit
            >
              <div ref={ref}>
                {exists && elt ? (
                  <TabRow
                    activeTitle={active[depth]}
                    levelPath={levelPath}
                    tabs={elt.children}
                    onTabAdd={onTabAdd}
                    onTabDelete={onTabDelete}
                    onTabRename={onTabRename}
                    onTabRowAdd={depth < maxRow - 1 ? onTabRowAdd : undefined}
                  />
                ) : (
                  <div className="TabsList" />
                )}
              </div>
            </CSSTransition>
          );
        })}
    </Tabs.Root>
  );
};
