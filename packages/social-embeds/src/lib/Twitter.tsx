import { useCallback } from 'react';
import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';

interface I_TwitterProps extends ComponentProps {
  data: {
    tweetId: string;
  };
}

export const Twitter = ({ data }: I_TwitterProps) => {
  const { tweetId } = data;

  const handleDivMount = useCallback((node: HTMLDivElement) => {
    if (node && tweetId) {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (window as any).twttr;
        if (t) t.widgets.createTweet(tweetId, node, { conversation: 'none' });
        else node.innerHTML = 'Your Browser block twitter widgets';
      }, 1000);
    } else {
      // TODO
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={handleDivMount}></div>;
};

const _component_: TComponentDeclaration = {
  name: 'twitter',
  DOM: Twitter,
  scripts: [
    {
      url: 'https://platform.twitter.com/widgets.js',
      async: true,
    },
  ],
};

export default _component_;
