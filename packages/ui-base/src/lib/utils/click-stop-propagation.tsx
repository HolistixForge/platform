import React, { ReactNode } from 'react';

type ClickStopPropagationProps = {
  children: ReactNode;
};

export const ClickStopPropagation: React.FC<ClickStopPropagationProps> = ({
  children,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
  };

  return <div onClick={handleClick}>{children}</div>;
};
