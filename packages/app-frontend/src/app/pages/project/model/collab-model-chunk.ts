import {
  useLocalSharedData as useLocalSharedDataOriginal,
  TValidSharedDataToCopy,
} from '@holistix-forge/collab/frontend';
import { useDispatcher as useDispatcherOriginal } from '@holistix-forge/reducers/frontend';
import { TCoreSharedData, TCoreEvent } from '@holistix-forge/core-graph';
import { TabPayload, TTabEvents, TTabsSharedData } from '@holistix-forge/tabs';
import { TWhiteboardSharedData, TSpaceEvent } from '@holistix-forge/whiteboard';
import { TChatEvent, TChatSharedData } from '@holistix-forge/chats';
import {
  TUserContainersEvents,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import { TJupyterEvent, TJupyterSharedData } from '@holistix-forge/jupyter';
import { TEventSocials } from '@holistix-forge/socials';
import { TNotionEvent } from '@holistix-forge/notion';

//

export type AllSharedData = TCoreSharedData &
  TTabsSharedData &
  TWhiteboardSharedData &
  TUserContainersSharedData &
  TJupyterSharedData &
  TChatSharedData;

type AllEvents =
  | TCoreEvent
  | TSpaceEvent
  | TUserContainersEvents
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
