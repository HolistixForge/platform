import { TF_User } from '@holistix/demiurge-types';
import { randomColor } from '../css-utils/css-utils';

const randomId = () => `${Math.floor(Math.random() * 1000000000)}`;

export const randomPP = () =>
  `https://i.pravatar.cc/${Math.round(Math.random() * 10000)}`;

export const randomGuys: TF_User[] = [
  {
    user_id: randomId(),
    username: 'github:duconLajoie42',
    firstname: 'Ducon',
    lastname: 'Lajoie',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:codeMaster99',
    firstname: 'Alice',
    lastname: 'Johnson',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:techGuru88',
    firstname: 'Bob',
    lastname: 'Smith',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:devQueen77',
    firstname: 'Carol',
    lastname: 'Williams',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:scriptKing66',
    firstname: 'David',
    lastname: 'Brown',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:codeNinja55',
    firstname: 'Eva',
    lastname: 'Jones',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:hackMaster44',
    firstname: 'Frank',
    lastname: 'Garcia',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:devWizard33',
    firstname: 'Grace',
    lastname: 'Martinez',
    picture: null,
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:programPro22',
    firstname: 'Hank',
    lastname: 'Rodriguez',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
  {
    user_id: randomId(),
    username: 'github:codeCrusader11',
    firstname: 'Ivy',
    lastname: 'Martinez',
    picture: randomPP(),
    live: false,
    color: randomColor(),
  },
];

export const randomGuy = (): TF_User => {
  const n = Math.floor(Math.random() * randomGuys.length);
  const u = randomGuys[n];
  return { ...u };
};
