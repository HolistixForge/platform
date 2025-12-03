import {
  useLocalSharedData as useLocalSharedDataOriginal,
  TValidSharedDataToCopy,
} from '@holistix/collab/frontend';
import { useDispatcher as useDispatcherOriginal } from '@holistix/reducers/frontend';
import { TCoreSharedData, TCoreEvent } from '@holistix/core-graph';
import { TabPayload, TTabEvents, TTabsSharedData } from '@holistix/tabs';
import { TSpaceSharedData, TSpaceEvent } from '@holistix/space';
import { TChatEvent, TChatSharedData } from '@holistix/chats';
import { TServerEvents, TServersSharedData } from '@holistix/user-containers';
import { TJupyterEvent, TJupyterSharedData } from '@holistix/jupyter';
import { TEventSocials } from '@holistix/socials';
import { TNotionEvent } from '@holistix/notion';

//

export type AllSharedData = TCoreSharedData &
  TTabsSharedData &
  TSpaceSharedData &
  TServersSharedData &
  TJupyterSharedData &
  TChatSharedData;

type AllEvents =
  | TCoreEvent
  | TSpaceEvent
  | TServerEvents
  | TJupyterEvent
  | TTabEvents<TabPayload>
  | TChatEvent
  | TEventSocials
  | TNotionEvent;

export const useDispatcher = useDispatcherOriginal<AllEvents>;

//

export const useAppLocalSharedData: (
  deps: (keyof AllSharedData)[],
  f: (data: TValidSharedDataToCopy<AllSharedData>) => any
) => ReturnType<typeof f> = useLocalSharedDataOriginal<AllSharedData>;

//
