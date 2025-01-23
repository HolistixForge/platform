import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';

interface I_YoutubeProps extends ComponentProps {
  data: {
    videoId: string;
  };
}

export const Youtube = ({ data }: I_YoutubeProps) => {
  const { videoId } = data;

  const src = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div style={{ height: '100%' }}>
      <iframe
        style={{ width: '100%', height: '100%' }}
        src={src}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

const _component_: TComponentDeclaration = {
  name: 'youtube',
  DOM: Youtube,
};

export default _component_;
