import { useEffect, useRef, useState } from 'react';
import { randomColor } from '../css-utils/css-utils';

import './tags.scss';

export type Tag = { text: string; color: string };

export const Tags = ({
  text,
  color,
  onEdit,
}: {
  text: string;
  color?: string;
  onEdit?: (newText: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmedText = editedText.trim();
    if (trimmedText && trimmedText !== text) {
      onEdit?.(trimmedText);
    } else {
      setEditedText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditedText(text);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editedText}
        onChange={(e) => setEditedText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="tag-input"
        style={{ color }}
      />
    );
  }

  return (
    <span
      className={`tag-label ${onEdit ? 'tag-editable' : ''}`}
      style={{ color: color }}
      onClick={() => onEdit && setIsEditing(true)}
    >
      {text}
    </span>
  );
};

export type TagsBarProps = {
  tags?: Tag[];
  addTag?: (arg: Tag) => void;
  editTag?: (index: number, newText: string) => void;
};

export const TagsBar = ({ tags = [], addTag, editTag }: TagsBarProps) => {
  const [otherTagsOpened, setOtherTagsOpened] = useState<boolean>(false);
  const [visibleTags, setVisibleTags] = useState<Tag[]>([]);
  const [otherTags, setOtherTags] = useState<Tag[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // The effect below resets both lists unconditionally, so it must not re-run
  // on a render that changed nothing. Depending on `tags` did exactly that:
  // every caller builds the array inline — `resource-list.tsx` and
  // `server-card.tsx` both do — so each render of the *parent* handed down a
  // new identity and replayed the whole measure-and-slice cascade, one frame
  // per tag, from zero. In a view that re-renders often that is a page pinned
  // to its own layout work; Storybook served one that never painted and would
  // not answer a screenshot.
  //
  // Keying on the contents rather than the reference cuts it. `tags` is a
  // short list of `{text, color}`, so stringifying it costs nothing next to
  // the cascade it prevents.
  const tagsKey = JSON.stringify(tags);

  useEffect(() => {
    if (!containerRef.current) return;

    const checkOverflow = (index: number) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const currentTotalWidth = Array.from(
        containerRef.current.children
      ).reduce(
        (acc, el) => acc + (el as HTMLElement).offsetWidth + 4, // 4px for gap
        0
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
          //setOtherTagsOpened(true);
          break;
        }
      }
    };

    updateTagsVisibility();
  }, [tagsKey]);

  const openMenu = () => {
    setOtherTagsOpened(!otherTagsOpened);
  };

  return (
    <>
      <div ref={containerRef} className="tags-container">
        {visibleTags.map((tag: Tag, visibleIndex: number) => {
          const originalIndex = tags.findIndex((t) => t === tag);
          return (
            <span key={visibleIndex} className="tag-appear">
              <Tags
                text={tag.text}
                color={tag.color}
                onEdit={
                  editTag
                    ? (newText) => editTag(originalIndex, newText)
                    : undefined
                }
              />
            </span>
          );
        })}

        <button
          className={`tag-toggle-btn ${
            otherTags.length > 0
              ? `has-others ${otherTagsOpened ? 'is-opened' : ''}`
              : 'no-others'
          }`}
          onClick={() =>
            otherTags.length > 0
              ? openMenu()
              : addTag?.({ text: `tag-${tags.length}`, color: randomColor() })
          }
        >
          <span
            className={`tag-toggle-text ${
              otherTags.length > 0 && !otherTagsOpened ? 'collapsed' : ''
            }`}
          >
            {otherTags.length > 0 ? (otherTagsOpened ? '-' : '...') : '+'}
          </span>
        </button>
      </div>

      {otherTagsOpened && (
        <div className="tags-dropdown">
          {otherTags.map((tag: Tag, otherIndex: number) => {
            const originalIndex = tags.findIndex((t) => t === tag);
            return (
              <Tags
                key={otherIndex}
                text={tag.text}
                color={tag.color}
                onEdit={
                  editTag
                    ? (newText) => editTag(originalIndex, newText)
                    : undefined
                }
              />
            );
          })}
          <button
            onClick={(e) => {
              addTag?.({ text: `tag-${tags.length}`, color: randomColor() });
            }}
            className="tag-add-btn"
          >
            +
          </button>
        </div>
      )}
    </>
  );
};
