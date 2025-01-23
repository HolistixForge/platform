import { CSSProperties } from 'react';
import { ComponentProps, TComponentDeclaration } from '@monorepo/lazy-factory';

interface I_ImgProps extends ComponentProps {
  data: {
    src: string;
    width?: number;
    height?: number;
    title?: string;
    style?: CSSProperties;
  };
}

const Img = ({ data }: I_ImgProps) => {
  const { src, width = null, height = null, title = null, style = {} } = data;

  const s = {
    width: width || 'auto',
    height: height || 'auto',
  };

  return (
    <div style={{ ...style, fontSize: 0 }}>
      <img alt={title || ''} title={title || ''} style={s} src={src} />
    </div>
  );
};

const _component_: TComponentDeclaration = {
  name: 'img',
  DOM: Img,
};

export default _component_;
