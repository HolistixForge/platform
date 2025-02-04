import { TComponentDeclaration, ComponentProps } from '@monorepo/lazy-factory';
import { useCallback } from 'react';

interface I_FacebookProps extends ComponentProps {
  data: {
    url: string;
  };
}

export const Facebook = ({ data }: I_FacebookProps) => {
  const { url } = data;

  const handleDivMount = useCallback((node: HTMLDivElement) => {
    if (node && url) {
      node.innerHTML = embed(url, node.offsetWidth + 2);

      (window as any).FB.XFBML.parse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={handleDivMount}></div>;
};

const _component_: TComponentDeclaration = {
  name: 'facebook',
  DOM: Facebook,
  scripts: [
    {
      url: 'https://connect.facebook.net/en_GB/sdk.js#xfbml=1&version=v14.0',
      async: true,
    },
  ],
};

export default _component_;

const embed = (url: string, width: number) => `
<div class="fb-post" data-href="${url}" data-width="${width}" data-show-text="true">
	<blockquote cite="${url}" class="fb-xfbml-parse-ignore">
    Facebook post
	</blockquote>
</div>`;
