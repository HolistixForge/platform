import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';
import { useCallback } from 'react';
import { insertScript } from '@monorepo/ui-toolkit';

interface I_TiktokProps extends ComponentProps {
  data: {
    url: string;
  };
}

export const Tiktok = ({ data }: I_TiktokProps) => {
  const { url } = data;

  const handleDivMount = useCallback(
    (node: HTMLDivElement) => {
      if (node && url) {
        fetch(`https://www.tiktok.com/oembed?url=${url}`)
          .then((r) => r.json())
          .then((json) => {
            node.innerHTML = json.html;
            insertScript({
              url: 'https://www.tiktok.com/embed.js',
              async: true,
            });
          });
      }
    },
    [url]
  );

  return <div ref={handleDivMount}></div>;
};

const _component_: TComponentDeclaration = {
  name: 'tiktok',
  DOM: Tiktok,
};

export default _component_;
