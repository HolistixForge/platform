import { ReactElement } from 'react';
import { SpaceAwareness, TUserPosition } from './spaceAwareness';
import { SpringRef as SpringRefWeb } from '@react-spring/web';
import { Avatar } from './avatar';
import { PointerTracker } from './pointerTracker';
import { Listenable } from './listenable';

//

type TAvatarInfo = {
  springApi?: SpringRefWeb;
  state: TUserPosition;
  reactElement?: ReactElement;
};

//

export class AvatarStore extends Listenable {
  private pointerTracker: PointerTracker;
  private avatars: Map<number, TAvatarInfo>;
  private ga: SpaceAwareness;

  constructor(pt: PointerTracker, ga: SpaceAwareness) {
    super();
    this.pointerTracker = pt;
    this.ga = ga;
    this.avatars = new Map<number, TAvatarInfo>();
    this.ga.addListener(() => {
      this.processUpdates();
    });
  }

  //

  private instanciateAvatar(k: number, u: TUserPosition): boolean {
    if (!u.key) return false;
    if (this.avatars.get(k)) return false;

    const setApi = (api: SpringRefWeb) => {
      const a = this.avatars.get(k) as TAvatarInfo;
      a.springApi = api;
      this.avatars.set(k, a);
    };

    const reactElement = (
      <Avatar
        key={k}
        setApi={setApi}
        id={k}
        name={u.user?.username}
        color={u.user?.color}
        toSpring={this.toSpring}
      />
    );

    this.avatars.set(k, { state: u, reactElement });

    return true;
  }

  //

  private updateAvatar(k: number, u: TUserPosition) {
    let a = this.avatars.get(k);
    if (!a) {
      this.instanciateAvatar(k, u);
      a = this.avatars.get(k);
    }
    if (a) {
      a.state = u;
      if (a.springApi) {
        a.springApi.start(() => this.toSpring(u));
      }
    }
  }

  //

  public updateAllAvatars() {
    this.avatars.forEach((a, k) => {
      this.updateAvatar(k, a.state);
    });
  }

  //

  // awareness state to Avatar spring style
  private toSpring(u: TUserPosition | undefined) {
    if (u && u.position) {
      const p = this.pointerTracker.toLocalPane(u.position);

      const { x: nx, y: ny, out } = this.pointerTracker.isPositionVisible(p);

      const color = u.inactive ? INACTIVE : u.user?.color || INACTIVE;

      return {
        '--user-color': color,
        opacity: out || u.inactive ? 0.25 : 1,
        top: `${ny}px`,
        left: `${nx}px`,
      };
    } else
      return {
        '--user-color': 'transparent',
        opacity: 0.25,
        top: '0px',
        left: '0px',
      };
  }

  //

  private processUpdates() {
    const ups = this.ga.getPointersUpdates();
    const keys = ups.map((up) => up.key);
    this.avatars.forEach((_, k) => {
      if (!keys.includes(k)) {
        this.avatars.delete(k);
      }
    });
    ups.forEach((up, key) => {
      this.updateAvatar(key, up);
    });
  }

  //

  public getAvatarsElements() {
    return Array.from(this.avatars.values()).map(
      (avatar) => avatar.reactElement,
    );
  }
}

//

const INACTIVE = 'var(--c-gray-9)';
