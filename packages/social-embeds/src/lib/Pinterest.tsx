import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';
import { useCallback } from 'react';

interface I_PinterestProps extends ComponentProps {
  data: {
    url: string;
  };
}

export const Pinterest = ({ data }: I_PinterestProps) => {
  const { url } = data;

  const handleDivMount = useCallback((node: HTMLDivElement) => {
    if (node && url) {
      node.innerHTML = embed(url);
      const i = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (window as any).PinUtils;
        if (p) {
          p.build();
          clearInterval(i);
        }
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={handleDivMount}></div>;
};

const _component_: TComponentDeclaration = {
  name: 'pinterest',
  DOM: Pinterest,
  scripts: [
    {
      url: '//assets.pinterest.com/js/pinit.js',
      async: true,
    },
  ],
};

export default _component_;

const embed = (url: string) => `
<a data-pin-do="embedPin" data-pin-width="medium" href="${url}"></a>`;
