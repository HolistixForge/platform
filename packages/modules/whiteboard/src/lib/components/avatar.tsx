import { useSpring, animated } from '@react-spring/web';
import { useEffect } from 'react';
import { Cursor } from './assets/cursor/Cursor';
import { SpringRef as SpringRefWeb } from '@react-spring/web';
import { TUserPosition } from '@holistix-forge/collab-engine';

//
//
//

type UserAvatarProps = {
  id: number;
  name: string;
  color: string;

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
    config: { duration: 0 }, // Immediate update with no animation
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
