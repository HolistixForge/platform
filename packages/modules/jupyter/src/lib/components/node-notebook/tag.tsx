import { icons } from '@holistix-forge/ui-base';

type TagProps = {
  text: string;
  textColor: string;
  crowned: boolean;
  removeTag: () => void;
  setCrowned: (crowned: boolean) => void;
};

export const Tag = ({
  text,
  textColor,
  crowned,
  removeTag,
  setCrowned,
}: TagProps) => {
  return (
    <span
      className="tag flex group/tag items-center font-medium transition-all"
      style={{
        color: textColor,
        gap: '8px',
        textTransform: 'uppercase',
        fontSize: '10px',
        lineHeight: '14px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px',
      }}
    >
      <span style={{ padding: '2px 10px' }} contentEditable>
        {text}
      </span>
      {crowned ? (
        <div className="cursor-pointer" onClick={() => setCrowned(false)}>
          <icons.Crowned />
        </div>
      ) : (
        <div
          className="group-[.testhover]/tag:block cursor-pointer hidden group-hover/tag:block"
          onClick={() => setCrowned(true)}
        >
          <icons.Crownable />
        </div>
      )}
      <icons.CloseSecondary
        onClick={removeTag}
        className="cursor-pointer group-[.testhover]/tag:block transition-all hidden group-hover/tag:block"
      />
    </span>
  );
};
