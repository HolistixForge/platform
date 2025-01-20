import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { icons } from '../assets/icons';

import './liveSpace.css';

interface LiveSpaceProps {
  color: string;
  status?: 'default' | 'resolved' | 'new';
}

export const LiveSpace = ({ color, status }: LiveSpaceProps) => {
  const [width, setWidth] = useState(200); // Largeur initiale
  const [height, setHeight] = useState(200); // Hauteur initiale
  const [isResizing, setIsResizing] = useState(false);

  const resizableRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const onMouseEnterAnchor = () => {
    gsap.to(anchorRef.current, { cursor: 'nwse-resize', duration: 0.3 });
  };

  const onMouseLeaveAnchor = () => {
    gsap.to(anchorRef.current, { cursor: 'auto', duration: 0.3 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    let initialX = e.clientX;
    let initialY = e.clientY;

    const handleResize = (e: MouseEvent) => {
      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;
      setWidth((prevWidth) => prevWidth + deltaX);
      setHeight((prevHeight) => prevHeight + deltaY);
      initialX = e.clientX;
      initialY = e.clientY;
    };

    const stopResize = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  };

  return (
    <div className="livespace">
      <div
        className="box"
        style={{
          backgroundColor: color,
        }}
      ></div>
      <h5>Space #6</h5>
      <div
        className={`resizable-div ${isResizing ? 'resizing' : ''}`}
        style={{
          width: width + 'px',
          height: height + 'px',
          borderColor: color,
        }}
      >
        <div
          ref={resizableRef}
          onMouseDown={onMouseDown}
          className="resize-area"
        >
          <div
            ref={anchorRef}
            onMouseEnter={onMouseEnterAnchor}
            onMouseLeave={onMouseLeaveAnchor}
            className="anchor"
          />
        </div>
        Content
      </div>
      <div className="comment">
        <div className="comment-icon">
          <icons.Chat
            style={{
              fill: color,
            }}
          />
          {status === 'resolved' && (
            <icons.Check className="resolved-comment" />
          )}
          {status === 'new' && (
            <div className="new-comment">
              <span>4</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
