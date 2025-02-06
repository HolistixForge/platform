import * as ContextMenu from '@radix-ui/react-context-menu';
import { ContextMenuNew } from './context-menu-logic';

/**
 *
 * @param param0
 * @returns
 */
export const NewEdgeContextMenu = ({
  triggerRef,
}: {
  triggerRef: React.Ref<HTMLSpanElement>;
}) => {
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
          <ContextMenuNew />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};
