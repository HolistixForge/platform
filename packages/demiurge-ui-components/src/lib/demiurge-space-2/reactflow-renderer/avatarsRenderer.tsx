import { useCallback, useEffect, useState } from 'react';
import { Listenable } from '../apis/listenable';
import { AvatarStore } from '../apis/avatarStore';

//

export const useRegisterListener = (o: Listenable) => {
  const [, _forceUpdate] = useState({});
  const forceUpdate = useCallback(() => _forceUpdate({}), []);
  useEffect(() => {
    o.addListener(() => forceUpdate());
    return () => o.removeListener?.(forceUpdate);
  });
  return forceUpdate;
};

//

export const AvatarsRenderer = ({
  avatarsStore,
}: {
  avatarsStore: AvatarStore;
}) => {
  useRegisterListener(avatarsStore);
  return (
    <div className="avtars-renderer">{avatarsStore.getAvatarsElements()}</div>
  );
};
