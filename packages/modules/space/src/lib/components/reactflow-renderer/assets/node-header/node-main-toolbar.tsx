import { useState, useCallback } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EraserIcon,
  PlayIcon,
  TrashIcon,
} from '@radix-ui/react-icons';

import { sleep } from '@monorepo/simple-types';
import {
  icons,
  ButtonIcon,
  ButtonIconProps,
  useAction,
} from '@monorepo/ui-base';
import { useDispatcher } from '@monorepo/collab-engine';

import { icons as icons2 } from '../inputsOutputs/icons';
import { DisableZoomDragPan } from '../../node-wrappers/disable-zoom-drag-pan';
import { useNodeContext } from '../../node-wrappers/node-wrapper';
import { TSpaceEvent } from '../../../../space-events';

import './node-main-toolbar.scss';

//

export type NodeMainToolbarProps = {
  buttons: ButtonIconProps[];
  className?: string;
  dropDown?: boolean;
};

export const NodeMainToolbar = ({
  buttons,
  className,
  dropDown = true,
}: NodeMainToolbarProps) => {
  return (
    <DisableZoomDragPan noDrag>
      <div className={`node-toolbar flex items-center ${className || ''}`}>
        {buttons.map((b, k) => (
          <ButtonIcon key={k} {...b} />
        ))}
        {dropDown && <ButtonIcon Icon={icons.Settings} />}
      </div>
    </DisableZoomDragPan>
  );
};

/**
 *
 */

type UseMakeButton = {
  isOpened?: boolean;
  open?: () => void;
  close?: () => void;
  //
  isExpanded?: boolean;
  expand?: () => void;
  reduce?: () => void;
  //
  isLocked?: boolean;
  onLock?: () => void;
  onUnlock?: () => void;
  //
  filterOut?: () => void;
  //
  onDelete?: () => Promise<void>;
  //
  onMoveToFront?: () => Promise<void>;
  onMoveToBack?: () => Promise<void>;
  //
  onFullScreen?: () => void;
  //
  onPlay?: () => void;
  onClear?: () => void;
};

export const useMakeButton = ({
  isOpened,
  open,
  close,
  //
  isExpanded,
  expand,
  reduce,
  //
  isLocked,
  onLock,
  onUnlock,
  //
  filterOut,
  //
  onDelete,
  //
  onMoveToFront,
  onMoveToBack,
  //
  // special buttons
  //
  onFullScreen,
  //
  onPlay,
  onClear,
}: UseMakeButton) => {
  //

  const trashButton = useAction(() => {
    if (onDelete) return onDelete();
    else return Promise.resolve();
  }, [onDelete]);

  const buttons: ButtonIconProps[] = [];

  if (onPlay)
    buttons.push({
      Icon: PlayIcon,
      callback: onPlay,
    });

  if (onClear) buttons.push({ Icon: EraserIcon, callback: onClear });

  if (isExpanded !== undefined) {
    if (isExpanded === false) {
      if (expand)
        buttons.push({
          Icon: icons.Reducted,
          callback: expand,
          className: 'nofill',
        });
    } else {
      if (reduce)
        buttons.push({
          Icon: icons.Expended,
          callback: reduce,
          className: 'nofill',
        });
    }
  }

  if (isLocked !== undefined) {
    if (isLocked === false) {
      if (onLock)
        buttons.push({
          Icon: icons.Lock,
          callback: onLock,
        });
    } else {
      if (onUnlock)
        buttons.push({
          Icon: icons.Unlock,
          callback: onUnlock,
        });
    }
  }

  if (onFullScreen)
    buttons.push({
      Icon: icons.Fullscreen,
      callback: onFullScreen,
    });

  if (onDelete) buttons.push({ ...trashButton, Icon: TrashIcon });

  if (isOpened !== undefined) {
    if (isOpened === true) {
      if (close)
        buttons.push({
          Icon: icons.Close,
          callback: close,
          className: 'nofill',
        });
    }
  }

  if (filterOut)
    buttons.push({
      Icon: icons2.EyeSlash,
      callback: filterOut,
    });

  if (onMoveToFront)
    buttons.push({
      Icon: ArrowUpIcon,
      callback: onMoveToFront,
    });

  if (onMoveToBack)
    buttons.push({
      Icon: ArrowDownIcon,
      callback: onMoveToBack,
    });

  return buttons;
};

//

export const useNodeHeaderButtons = ({
  onDelete,
  onPlay,
  onClear,
}: {
  onDelete?: () => Promise<void>;
  onPlay?: () => void;
  onClear?: () => void;
}) => {
  const dispatcher = useDispatcher<TSpaceEvent>();

  const {
    id,
    viewId,
    viewStatus,
    expand,
    reduce,
    isOpened,
    open,
    close,
    filterOut,
  } = useNodeContext();

  const handleMoveToFront = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'space:move-node-to-front',
      viewId: viewId,
      nid: id,
    });
  }, [dispatcher, id, viewId]);

  const handleMoveToBack = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'space:move-node-to-back',
      viewId: viewId,
      nid: id,
    });
  }, [dispatcher, id, viewId]);

  const isExpanded = viewStatus.mode === 'EXPANDED';

  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete,
    isOpened,
    open,
    close,
    filterOut,
    onMoveToFront: handleMoveToFront,
    onMoveToBack: handleMoveToBack,
    onPlay,
    onClear,
  });

  return buttons;
};

//

export const useTestToolbarButtons = (_isOpened = false, _isLocked = false) => {
  const [isOpened, setIsOpened] = useState(_isOpened);
  const [isLocked, setIsLocked] = useState(_isLocked);
  const buttons = useMakeButton({
    isExpanded: isOpened,
    expand: () => setIsOpened(true),
    reduce: () => setIsOpened(false),

    isLocked,
    onLock: () => setIsLocked(true),
    onUnlock: () => setIsLocked(false),

    onPlay: () => null,
    onClear: () => null,

    onFullScreen: () => null,

    onDelete: sleep,
  });
  return { buttons };
};
