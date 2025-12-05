import { AvatarStore } from './apis/avatarStore';
import { useRegisterListener } from '@holistix-forge/ui-toolkit/frontend';
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
