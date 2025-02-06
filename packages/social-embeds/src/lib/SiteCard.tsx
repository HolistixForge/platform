import { useEffect, useState } from 'react';
import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';

import './SiteCard.css';

const META_OG_READER_API =
  'https://q3295h9usg.execute-api.us-east-2.amazonaws.com/default';

interface I_SiteCardProps extends ComponentProps {
  data: {
    url: string;
  };
}

const useMetaOg = (url: string) => {
  const [ogMetas, setOgMetas] = useState<any>(null);

  useEffect(() => {
    fetch(`${META_OG_READER_API}?url=${encodeURIComponent(url)}`)
      .then(function (response) {
        // The API call was successful!
        return response.json();
      })
      .then((metas) => setOgMetas(metas))
      .catch(function (err) {
        // There was an error
        console.warn('Something went wrong.', err);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ogMetas,
  };
};

export const SiteCardDom = ({ data }: I_SiteCardProps) => {
  const { url } = data;

  const { ogMetas } = useMetaOg(url);

  return (
    <div className="sitecard">
      {ogMetas && (
        <a href={ogMetas['og:url']} target="_blank" rel="noopener noreferrer">
          <img src={ogMetas['og:image']} alt={ogMetas['og:image:alt']} />
          <div className="sitecard-bottom">
            <p className="sitecard-title">{ogMetas['og:title']}</p>
            <p className="sitecard-description">{ogMetas['og:description']}</p>
            <p className="sitecard-site">{ogMetas['og:site_name']}</p>
          </div>
        </a>
      )}
    </div>
  );
};

/*
const ellipsis = (s: string, l: number) =>
  s.length > l ? s.substring(0, l) + '...' : s;

function openInNewTab(url: string) {
  
  (window as any).open(url, '_blank').focus();
}

const FONT_SIZE = 0.4;

const W = 430;
const H = 330;
const IW = 400;
const IH = 200;

const titleFontProps = {
  // font: '/fonts/Inter-Bold.woff',
  // letterSpacing: 0.0,
  lineHeight: 1,
  'material-toneMapped': false,
};

const normalFontProps = {
  // font: '/fonts/Inter-Regular.woff',
  // letterSpacing: 0.0,
  lineHeight: 1,
  'material-toneMapped': false,
};
*/

const _component_: TComponentDeclaration = {
  name: 'sitecard',
  DOM: SiteCardDom,
};

export default _component_;
