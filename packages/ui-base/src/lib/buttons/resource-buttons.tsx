import { ClipboardCopyIcon, TrashIcon } from '@radix-ui/react-icons';
import { icons } from '../assets/icons';
import { ButtonBase } from './buttonBase';
import { TAction } from './useAction';
import { CSSProperties } from 'react';

export type ResourceButtonsProps = {
  type:
    | 'play'
    | 'stop'
    | 'pause'
    | 'enter'
    | 'host'
    | 'cloud'
    | 'share'
    | 'docker'
    | 'delete';
  hover?: boolean;
  size?: 'small' | 'medium';
  actionOriginId?: string;
  style?: CSSProperties;
} & Partial<TAction>;

//

export const ResourceButtons = (props: ResourceButtonsProps) => {
  const { type, size = 'medium', hover, ...others } = props;
  let Icon;
  if (type === 'play') Icon = icons.PlayResource;
  else if (type === 'pause') Icon = icons.PauseResource;
  else if (type === 'stop') Icon = icons.StopResource;
  else if (type === 'enter') Icon = icons.EnterResource;
  else if (type === 'cloud') Icon = icons.Cloud;
  else if (type === 'docker') Icon = ClipboardCopyIcon;
  else if (type === 'delete') Icon = TrashIcon;

  let text: string | undefined = undefined;
  if (type === 'docker' || type === 'share' || type === 'host') text = type;

  return (
    <ButtonBase
      Icon={Icon}
      text={text}
      className={`resource ${type} ${size} ${hover ? 'testhover' : ''}`}
      {...others}
    />
  );
};
