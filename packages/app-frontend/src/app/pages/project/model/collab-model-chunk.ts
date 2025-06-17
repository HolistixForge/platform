import {
  useDispatcher as useDispatcherCollab,
  useSharedData as useSharedDataCollab,
  TValidSharedDataToCopy,
} from '@monorepo/collab-engine';
import { TCoreSharedData, TCoreEvent } from '@monorepo/core';
import { TabPayload, TTabEvents, TTabsSharedData } from '@monorepo/tabs';
import { TSpaceSharedData, TSpaceEvent } from '@monorepo/space';
import { TChatEvent, TChatSharedData } from '@monorepo/chats';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { TJupyterEvent, TJupyterSharedData } from '@monorepo/jupyter';
import { TEventSocials } from '@monorepo/socials';
import { TNotionEvent } from '@monorepo/notion';

import { modules } from './modules';

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

export const useDispatcher = useDispatcherCollab<AllEvents>;

export const collabChunks = modules.map((module) => module.collabChunk);

//

export const useSharedData: (
  deps: (keyof AllSharedData)[],
  f: (data: TValidSharedDataToCopy<AllSharedData>) => any
) => ReturnType<typeof f> = useSharedDataCollab<AllSharedData>;

//
