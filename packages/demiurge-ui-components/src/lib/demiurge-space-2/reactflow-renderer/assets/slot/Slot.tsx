import React from 'react';
import { Handle, HandleType, Position } from 'reactflow';

import './slot.css';

export interface SlotProps {
  isConnectable?: boolean;
  position: Position;
  id: string;
  type: HandleType;
  name: string;

  onMouseOver?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
  onClick?: (event: React.MouseEvent) => void;
}

export const Slot = ({
  isConnectable,
  position,
  id,
  type,
  name,
  onMouseOver,
  onMouseLeave,
  onClick,
}: SlotProps) => {
  return (
    <li>
      <p>{name}</p>
      <Handle
        type={type}
        id={id}
        position={position}
        isConnectable={isConnectable}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />
    </li>
  );
};
