import { TCollaborator, TF_User } from '@holistix/types';
import { randomGuys } from '../utils/random-guys';
import { useCallback, useEffect, useState } from 'react';

const users = randomGuys;

export const scopes = {
  manger: { title: 'Manger beaucoup' },
  dormir: { title: 'Dormir profondement' },
  courir: { title: 'Courir vite' },
  nager: { title: 'Nager loin' },
  vomir: { title: 'Vomir tout' },
  conduire: { title: "Conduire n'importe comment" },
  boire: { title: 'Boire trop' },
};

export const useTestUsersScopes = () => {
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<TCollaborator[]>([]);

  useEffect(() => {
    setTimeout(() => {
      const cs = users
        .filter((u) => u.firstname?.includes('o'))
        .map((u, k) => {
          const s: string[] = [];
          Object.keys(scopes).forEach((_s) => {
            if (Math.random() > 0.5) s.push(_s);
          });
          return {
            ...u,
            scope: s,
            is_owner: u.username === 'github:John-Doe_deLaVega_du_29',
          };
        });
      setCollaborators(cs);
      setCollaboratorsLoading(false);
    }, 2000);
  }, []);

  const [searchResults, setSearchResults] = useState<TF_User[]>([]);
  const [searchLoading, setSearchLoading] = useState({
    last: '',
    fetching: false,
  });

  //

  const onSearch = useCallback((s: string) => {
    setSearchLoading({ last: s, fetching: true });
    setTimeout(() => {
      const _s = s.toLowerCase();
      setSearchResults(
        users.filter(
          (u) =>
            u.firstname?.toLowerCase().includes(_s) ||
            u.lastname?.toLowerCase().includes(_s) ||
            u.username.toLowerCase().includes(_s),
        ),
      );
      setSearchLoading((searchFetching) => {
        if (searchFetching.last === s) return { last: s, fetching: false };
        return searchFetching;
      });
    }, 1500);
  }, []);

  //

  const onDelete = useCallback((u: TF_User) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setCollaborators((collaborators) => {
          return collaborators.filter((c) => c.user_id !== u.user_id);
        });
        resolve();
      }, 1500);
    });
  }, []);

  //

  const onValidateUser = useCallback((c: TCollaborator) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setCollaborators((collaborators) => {
          const ncs = collaborators.filter((u) => u.user_id !== c.user_id);
          ncs.push(c);
          return ncs;
        });
        resolve();
      }, 1500);
    });
  }, []);

  return {
    collaborators,
    collaboratorsLoading,
    searchResults,
    searchLoading: searchLoading.fetching,
    onSearch,
    onDelete,
    onValidateUser,
  };
};
