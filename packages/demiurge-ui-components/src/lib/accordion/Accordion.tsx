import { icons } from '../assets/icons';
import './accordion.css';

export type AccordionProps = {
  title: string;
  content: string;
  functionName: string;
  isOpened: boolean;
  open: () => void;
  close: () => void;
};

export const Accordion = ({
  title,
  content,
  functionName,
  isOpened,
  open,
  close,
}: AccordionProps) => {
  return (
    <div className="accordion-item">
      <div
        className="accordion-title"
        onClick={() => (isOpened ? close() : open())}
      >
        <icons.Chevron
          style={{
            transition: '.2s',
            transform: isOpened ? 'rotate(90deg)' : '',
          }}
        />
        <p>{title}</p>
        <span>{functionName}</span>
      </div>

      {isOpened && <div className="accordion-content">{content}</div>}
    </div>
  );
};
