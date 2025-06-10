import { useState } from 'react';

import * as ContextMenu from '@radix-ui/react-context-menu';
import { DotFilledIcon, CheckIcon } from '@radix-ui/react-icons';

export const ContextualMenu = ({
  triggerRef,
}: {
  triggerRef: React.Ref<HTMLSpanElement>;
}) => {
  const [bookmarksChecked, setBookmarksChecked] = useState(true);
  const [urlsChecked, setUrlsChecked] = useState(false);
  const [person, setPerson] = useState('pedro');

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger ref={triggerRef} className="ContextMenuTrigger" />
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="ContextMenuContent"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          sideOffset={5}
          align="end"
        >
          // exemples:
          <ContextMenu.Item className="ContextMenuItem">
            Back <div className="RightSlot">⌘+[</div>
          </ContextMenu.Item>
          <ContextMenu.Item className="ContextMenuItem" disabled>
            Foward <div className="RightSlot">⌘+]</div>
          </ContextMenu.Item>
          <ContextMenu.Item className="ContextMenuItem">
            Reload <div className="RightSlot">⌘+R</div>
          </ContextMenu.Item>
          <ContextMenu.Separator className="ContextMenuSeparator" />
          <ContextMenu.CheckboxItem
            className="ContextMenuCheckboxItem"
            checked={bookmarksChecked}
            onCheckedChange={setBookmarksChecked}
          >
            <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
              <CheckIcon />
            </ContextMenu.ItemIndicator>
            Show Bookmarks <div className="RightSlot">⌘+B</div>
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem
            className="ContextMenuCheckboxItem"
            checked={urlsChecked}
            onCheckedChange={setUrlsChecked}
          >
            <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
              <CheckIcon />
            </ContextMenu.ItemIndicator>
            Show Full URLs
          </ContextMenu.CheckboxItem>
          <ContextMenu.Separator className="ContextMenuSeparator" />
          <ContextMenu.Label className="ContextMenuLabel">
            People
          </ContextMenu.Label>
          <ContextMenu.RadioGroup value={person} onValueChange={setPerson}>
            <ContextMenu.RadioItem
              className="ContextMenuRadioItem"
              value="pedro"
            >
              <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
                <DotFilledIcon />
              </ContextMenu.ItemIndicator>
              Pedro Duarte
            </ContextMenu.RadioItem>
            <ContextMenu.RadioItem
              className="ContextMenuRadioItem"
              value="colm"
            >
              <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
                <DotFilledIcon />
              </ContextMenu.ItemIndicator>
              Colm Tuite
            </ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};
