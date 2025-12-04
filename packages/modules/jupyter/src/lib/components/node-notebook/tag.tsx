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
      style={{
        color: textColor,
      }}
      className={`tag flex group/tag items-center gap-2 uppercase text-[10px] font-medium leading-[14px] bg-white bg-opacity-5 rounded-[4px] transition-all`}
    >
      <span className="py-[2px] px-[10px]" contentEditable>
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
