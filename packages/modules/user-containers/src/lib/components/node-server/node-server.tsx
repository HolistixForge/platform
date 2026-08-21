import { CSSProperties, useCallback } from 'react';

import {
  NodeHeader,
  DisableZoomDragPan,
  useNodeContext,
  InputsAndOutputs,
  useNodeHeaderButtons,
} from '@holistix-forge/whiteboard/frontend';
import { TGraphNode } from '@holistix-forge/core-graph';
import {
  useLocalSharedData,
  useAwarenessUserList,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TTabEvents } from '@holistix-forge/tabs';
import { TJsonObject } from '@holistix-forge/simple-types';
import { useModuleExports } from '@holistix-forge/module/frontend';
import { useQueriesUsers } from '@holistix-forge/frontend-data';
import { TF_User, TG_User } from '@holistix-forge/types';

import { UserContainerCardInternal } from '../server-card';
import { TUserContainer } from '../../servers-types';
import { TUserContainersSharedData } from '../../servers-shared-model';
import { TUserContainersEvents } from '../../servers-events';
import { TContainerImageInfo } from '../../container-image';
import {
  TContainerRunnerFrontend,
  TUserContainersFrontendExports,
} from '../../../frontend';

//

/**
 * The runners this project can actually use.
 *
 * The frontend registry is static — every runner a build knows about — while
 * the gateway publishes the subset it is configured for. Intersecting the two
 * is what keeps a "Platform" button off screens whose deployment has no
 * container broker behind it. Before the gateway has published anything, fall
 * back to the static set rather than showing no runner at all.
 */
export const useRunnerFrontend = () => {
  const exports = useModuleExports<{
    'user-containers': TUserContainersFrontendExports;
  }>('user-containers');
  const registered = exports['user-containers'].getRunners();

  const available = useLocalSharedData<TUserContainersSharedData>(
    ['user-containers:runners'],
    (sd) => sd['user-containers:runners']
  );

  if (!available || available.size === 0) return registered;

  return new Map(
    Array.from(registered.entries()).filter(([id]) => available.get(id))
  );
};

export type UseContainerProps = {
  container: TUserContainer;
  image: TContainerImageInfo | undefined;
  onDelete: () => Promise<void>;
  onOpenService: (name: string) => void;
  onSelectRunner: (runner_id: string) => Promise<void>;
};

export const useContainerProps = (
  container_id: string
): UseContainerProps | undefined => {
  //

  const uc: TUserContainer = useLocalSharedData<TUserContainersSharedData>(
    ['user-containers:containers'],
    (sd) => sd['user-containers:containers'].get(`${container_id}`)
  );

  const containerImages: Map<string, TContainerImageInfo> =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:images'],
      (sd) => sd['user-containers:images']
    );

  const dispatcher = useDispatcher<
    TUserContainersEvents | TTabEvents<TJsonObject>
  >();

  const onDelete = useCallback(async () => {
    if (uc)
      await dispatcher.dispatch({
        type: 'user-container:delete',
        user_container_id: container_id,
      });
  }, [dispatcher, container_id, uc]);

  //

  const onSelectRunner = useCallback(
    async (runner_id: string) => {
      if (uc) {
        // First set the runner
        await dispatcher.dispatch({
          type: 'user-container:set-runner',
          user_container_id: container_id,
          runner_id,
        });
        // Then start the container
        await dispatcher.dispatch({
          type: 'user-container:start',
          user_container_id: container_id,
        });
      }
    },
    [dispatcher, container_id, uc]
  );

  //

  const onOpenService = useCallback(
    async (name: string) => {
      if (uc) {
        const service = uc.httpServices.find((svc) => svc.name === name);
        if (service) {
          await dispatcher.dispatch({
            type: 'tabs:add-tab',
            path: [],
            title: `${uc.container_name}:${service.name}`,
            payload: {
              type: 'resource-ui',
              user_container_id: container_id,
              service_name: name,
            },
          });
        }
      }
    },
    [dispatcher, container_id, uc]
  );

  //
  if (uc)
    return {
      onDelete,
      onOpenService,
      onSelectRunner,
      container: uc,
      image: containerImages.get(`${uc.image_id}`),
    };

  return undefined;
};

//

/**
 * The guest identity the collab config falls back to. Not a person, and the
 * users API has nothing to say about it — the header filters it out of its own
 * avatar row for the same reason.
 */
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';

export type TContainerPresence = {
  /** Who is in the project right now. */
  liveUsers: TF_User[];
  /** Whose machine this container runs on, for a local placement. */
  host?: TF_User;
};

/**
 * Who is on this service, and whose machine it runs on.
 *
 * `server-card` has drawn both since it was written and nothing ever handed it
 * either one, so the pulsing avatars that say "this is running on Marc's
 * laptop, and three of us are looking at it" simply never appeared. This is
 * the wiring that was missing, kept out of the card so the card stays a
 * component that draws what it is given.
 *
 * **liveUsers** is the project's collab session. A container has no presence
 * channel of its own — nothing reports who has a notebook open inside it — so
 * "on this service" can only mean "in the project this service belongs to".
 * Everyone, including you: a solo session still has a person in it, and a
 * bubble that vanished when you were alone would read as a broken bubble.
 * Deduplicated by user, because awareness is keyed by *connection* and someone
 * with two tabs open is still one person.
 *
 * **host** only exists for a local placement, which is the whole point of the
 * distinction the blue ring draws: the platform is owned by nobody, and a card
 * that showed an owner for it would be inventing one. The host is fetched
 * whether or not they are connected — the machine keeps running the container
 * after they close the board.
 */
export const useContainerPresence = (
  container: TUserContainer | undefined
): TContainerPresence => {
  const live = useAwarenessUserList();

  const host_user_id =
    container?.runner.id === 'local' &&
    typeof container.runner.user_id === 'string'
      ? container.runner.user_id
      : undefined;

  const liveIds = Array.from(
    new Set(
      live.map((u) => u.user_id).filter((id) => id && id !== GUEST_USER_ID)
    )
  );

  // One query per person either way — `useQueriesUsers` keys on `['user', id]`,
  // so the host already in the session costs nothing extra.
  const ids =
    host_user_id && !liveIds.includes(host_user_id)
      ? [...liveIds, host_user_id]
      : liveIds;

  const queries = useQueriesUsers(ids);

  const fetched = new Map<string, TG_User>();
  queries.forEach((q) => {
    if (q.status === 'success' && q.data?.user_id)
      fetched.set(q.data.user_id, q.data);
  });

  // A user whose record has not arrived is left out rather than drawn as a
  // blank avatar: the bubble is a count of people, and a placeholder in it is
  // a person who is not there.
  //
  // `flatMap` and not `map().filter()`: a type guard on the filter has to be
  // written against the mapped literal, and `TF_User` is not assignable to it
  // — `live` is optional there and required here. Returning nothing for an
  // absent record says the same thing without the cast.
  const liveUsers: TF_User[] = liveIds.flatMap((id) => {
    const u = fetched.get(id);
    if (!u) return [];
    return [
      {
        ...u,
        color: live.find((l) => l.user_id === id)?.color,
        live: true,
      },
    ];
  });

  const hostRecord = host_user_id ? fetched.get(host_user_id) : undefined;

  return {
    liveUsers,
    host: hostRecord
      ? {
          ...hostRecord,
          color: live.find((l) => l.user_id === host_user_id)?.color,
        }
      : undefined,
  };
};

//

export const NodeServer = ({
  node,
}: {
  node: TGraphNode<{ container_id: string }>;
}) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const container_id = node.data!.container_id as string;

  const useNodeValue = useNodeContext();

  const runners = useRunnerFrontend();

  const props = useContainerProps(container_id);

  const presence = useContainerPresence(props?.container);

  if (props)
    return (
      <NodeServerInternal
        {...useNodeValue}
        {...props}
        {...presence}
        runners={runners}
      />
    );

  return null;
};

//

export const ServerCard = ({ container_id }: { container_id: string }) => {
  const props = useContainerProps(container_id);

  const runners = useRunnerFrontend();

  const presence = useContainerPresence(props?.container);

  if (props)
    return (
      <div style={{ '--node-wrapper-header-height': '-8px' } as CSSProperties}>
        <UserContainerCardInternal
          {...props}
          {...presence}
          runners={runners}
        />
      </div>
    );

  return null;
};

/**
 *
 */

export const NodeServerInternal = (
  // `Partial`: the stories mount this component directly, with no collab
  // session behind it to have a presence in.
  props: UseContainerProps &
    Partial<TContainerPresence> & {
      runners: Map<string, TContainerRunnerFrontend>;
    }
) => {
  //

  const { onDelete, ...otherProps } = props;

  const { id, isOpened, selected, open } = useNodeContext();

  const buttons = useNodeHeaderButtons({
    onDelete,
  });

  return (
    <div
      className={`common-node server-node`}
      style={{ '--node-wrapper-header-height': '78px' } as CSSProperties}
    >
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="server"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div className="node-wrapper-body server">
            <UserContainerCardInternal {...otherProps} onDelete={onDelete} />
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
