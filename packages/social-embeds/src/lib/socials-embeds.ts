import twitter, { Twitter } from './Twitter';
import youtube, { Youtube } from './Youtube';
import instagram, { Instagram } from './Instagram';
import sitecard, { SiteCardDom } from './SiteCard';
import facebook, { Facebook } from './Facebook';
import pinterest, { Pinterest } from './Pinterest';
import tiktok, { Tiktok } from './Tiktok';

import { TLibrary } from '@monorepo/lazy-factory';

import './socials-embeds.scss';

const socials: TLibrary = {
  name: 'socials',
  description: 'socials embed components',
  author: 'Demiurge',
  components: [
    twitter,
    youtube,
    instagram,
    sitecard,
    facebook,
    pinterest,
    tiktok,
  ],
};

export default socials;

export {
  Twitter,
  Youtube,
  Instagram,
  SiteCardDom,
  Facebook,
  Pinterest,
  Tiktok,
};
