import { AvatarStore } from './apis/avatarStore';
import { useRegisterListener } from '@holistix/simple-types';
//

export const AvatarsRenderer = ({
  avatarsStore,
}: {
  avatarsStore: AvatarStore;
}) => {
  useRegisterListener(avatarsStore, 'AvatarsRenderer, avatarsStore');
  return (
    <div className="avtars-renderer">{avatarsStore.getAvatarsElements()}</div>
  );
};
