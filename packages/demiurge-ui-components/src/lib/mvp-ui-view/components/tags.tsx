import { useEffect, useRef, useState } from 'react';
import { randomColor } from '../../css-utils/css-utils';

export type Tag = { text: string; color: string };

export const Tags = ({ text, color }: { text: string; color?: string }) => {
  return (
    <span
      className={`uppercase bg-[#252546] rounded-[4px] px-2 py-1 text-[10px] font-medium leading-[14px] h-[22px] flex items-center`}
      style={{ color: color }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};

export type TagsBarProps = {
  tags?: Tag[];
  addTag?: (arg: Tag) => void;
};

export const TagsBar = ({ tags = [], addTag }: TagsBarProps) => {
  const [otherTagsOpened, setOtherTagsOpened] = useState<boolean>(false);
  const [visibleTags, setVisibleTags] = useState<Tag[]>([]);
  const [otherTags, setOtherTags] = useState<Tag[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const checkOverflow = (index: number) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const currentTotalWidth = Array.from(
        containerRef.current.children,
      ).reduce(
        (acc, el) => acc + (el as HTMLElement).offsetWidth + 4, // 4px for gap
        0,
      );

      return currentTotalWidth < containerWidth;
    };

    const updateTagsVisibility = async () => {
      setVisibleTags([]);
      setOtherTags([]);

      for (let i = 0; i < tags.length; i++) {
        setVisibleTags((prev) => [...prev, tags[i]]);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (!checkOverflow(i)) {
          setVisibleTags((prev) => prev.slice(0, -1));
          setOtherTags(tags.slice(i));
          setOtherTagsOpened(true);
          break;
        }
      }
    };

    updateTagsVisibility();
  }, [tags]);

  const openMenu = () => {
    setOtherTagsOpened(!otherTagsOpened);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="tags-container relative z-20 w-[80%] flex flex-wrap items-center mt-4 gap-1"
      >
        {visibleTags.map((tag: Tag, index: number) => (
          <span
            key={index}
            className="transition-opacity duration-300 opacity-100"
          >
            <Tags text={tag.text} color={tag.color} />
          </span>
        ))}

        <button
          className={`border ${
            otherTags.length > 0 ? 'border-[#A998DA]' : 'border-[#50506C]'
          } h-5 w-5 ${otherTagsOpened && '!border-[#833A9D]'} rounded-[4px] flex items-center justify-center text-[#141432] text-center hover:bg-white/10  transition-all cursor-pointer`}
          onClick={() =>
            otherTags.length > 0
              ? openMenu()
              : addTag?.({ text: `tag-${tags.length}`, color: randomColor() })
          }
        >
          <span
            className={`ml-[0.5px] mt-[0.5px] leading-[0%] ${
              otherTags.length > 0
                ? `text-[#A998DA] ${!otherTagsOpened && 'mb-2'}`
                : 'text-[#50506C]'
            }`}
          >
            {otherTags.length > 0 ? <>{otherTagsOpened ? '-' : '...'}</> : '+'}
          </span>
        </button>
      </div>

      {otherTagsOpened && (
        <div className="tags-container absolute px-2 py-2 flex-wrap top-full max-h-[200px] overflow-y-auto flex right-0 w-full bg-[#2C2C47] z-30 rounded-[4px] border border-[#833A9D] gap-[5px]">
          {otherTags.map((tag: Tag, index: number) => (
            <Tags key={index} text={tag.text} color={tag.color} />
          ))}
          <button
            onClick={(e) => {
              addTag?.({ text: `tag-${tags.length}`, color: randomColor() });
            }}
            className={`border h-5 w-5 rounded-[4px] flex items-center justify-center border-[#50506C] text-[#50506C] text-center hover:bg-white/10  transition-all cursor-pointer`}
          >
            +
          </button>
        </div>
      )}
    </>
  );
};
