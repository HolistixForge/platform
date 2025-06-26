import { useState } from 'react';

import { TSpaceMenuEntry } from '@monorepo/module/frontend';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRightIcon } from '@radix-ui/react-icons';

//

export const ContextualMenu = ({
  triggerRef,
  entries: entriesFn,
}: {
  triggerRef: React.Ref<HTMLSpanElement>;
  entries: () => TSpaceMenuEntry[];
}) => {
  const [entries, setEntries] = useState<TSpaceMenuEntry[]>([]);

  return (
    <ContextMenu.Root
      onOpenChange={() => {
        setEntries(entriesFn());
      }}
    >
      <ContextMenu.Trigger ref={triggerRef} className="ContextMenuTrigger" />
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="ContextMenuContent"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          sideOffset={5}
          align="end"
        >
          <ContextualMenuGenerator entries={entries} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

//

const ContextualMenuGenerator = ({
  entries,
}: {
  entries: TSpaceMenuEntry[];
}) => {
  return entries.map((entry, k) => {
    switch (entry.type) {
      case 'item':
        return (
          <ContextMenu.Item
            className="ContextMenuItem"
            key={entry.label}
            onClick={entry.onClick}
            disabled={entry.disabled}
          >
            {entry.label}
            {entry.Form && <entry.Form />}
          </ContextMenu.Item>
        );
      case 'separator':
        return (
          <ContextMenu.Separator className="ContextMenuSeparator" key={k} />
        );
      case 'label':
        return (
          <ContextMenu.Label className="ContextMenuLabel" key={entry.label}>
            {entry.label}
          </ContextMenu.Label>
        );
      case 'sub-menu':
        return (
          <ContextMenu.Sub key={entry.label}>
            <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
              {entry.label}
              <div className="RightSlot">
                <ChevronRightIcon />
              </div>
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="ContextMenuSubContent"
                sideOffset={2}
                alignOffset={-5}
              >
                <ContextualMenuGenerator entries={entry.entries} />
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
        );
    }
  });
};
