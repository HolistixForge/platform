import { useSpring, animated } from '@react-spring/web';
import { useEffect } from 'react';
import { Cursor } from './assets/cursor/Cursor';
import { SpringRef as SpringRefWeb } from '@react-spring/web';
import { TUserPosition } from '../apis/spaceAwareness';

//
//
//

type UserAvatarProps = {
  id: number;
  name: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setApi: (sr: SpringRefWeb) => any;
  toSpring: (u: TUserPosition | undefined) => {
    '--user-color': string;
    opacity: number;
    top: string;
    left: string;
  };
};

//

export const Avatar = ({ name, color, setApi, toSpring }: UserAvatarProps) => {
  const [style, api] = useSpring(() => ({
    ...toSpring(undefined),
    config: { mass: 5, tension: 500, friction: 150 },
  }));

  //

  useEffect(() => {
    setApi(api as any);
  }, [api, setApi]);

  return (
    <animated.div
      style={{
        position: 'absolute',
        ...style,
      }}
    >
      <Cursor
        fill={'color'}
        user_id=""
        username={name}
        color={color}
        firstname={''}
        lastname={''}
        picture={''}
      />
    </animated.div>
  );
};

//
//
//
