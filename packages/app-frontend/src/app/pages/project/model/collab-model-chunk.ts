import {
  useLocalSharedData as useLocalSharedDataOriginal,
  TValidSharedDataToCopy,
} from '@monorepo/collab/frontend';
import { useDispatcher as useDispatcherOriginal } from '@monorepo/reducers/frontend';
import { TCoreSharedData, TCoreEvent } from '@monorepo/core-graph';
import { TabPayload, TTabEvents, TTabsSharedData } from '@monorepo/tabs';
import { TSpaceSharedData, TSpaceEvent } from '@monorepo/space';
import { TChatEvent, TChatSharedData } from '@monorepo/chats';
import { TServerEvents, TServersSharedData } from '@monorepo/user-containers';
import { TJupyterEvent, TJupyterSharedData } from '@monorepo/jupyter';
import { TEventSocials } from '@monorepo/socials';
import { TNotionEvent } from '@monorepo/notion';

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
