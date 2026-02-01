import { useState, useEffect } from 'react';

import { icons } from '@holistix-forge/ui-base';

//

type ResourceButtonsProps = {
  isOpen: boolean;
};

interface Resource {
  id: number;
  name: string;
  color: string;
}

const ressources: Resource[] = [
  {
    id: 0,
    name: 'Notebook',
    color: '#CA922E',
  },
  {
    id: 1,
    name: 'Server',
    color: '#45AFDD',
  },
  {
    id: 2,
    name: 'Role',
    color: '#C25D50',
  },
  {
    id: 3,
    name: 'User',
    color: '#59C088',
  },
  {
    id: 4,
    name: 'Group',
    color: '#AA5ECE',
  },
  {
    id: 5,
    name: 'Volume',
    color: '#5C39BE',
  },
  {
    id: 6,
    name: 'System',
    color: '#398EBE',
  },
  {
    id: 7,
    name: 'Space',
    color: '#7151A6',
  },
];

export const ResourceSelection = ({ isOpen }: ResourceButtonsProps) => {
  const [selected, setSelected] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(isOpen);

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

  return (
    <div
      onClick={() => setIsMenuOpen(!isMenuOpen)}
      style={{
        backgroundColor: ressources[selected].color,
        height: '72px',
        minWidth: '388px',
        borderRadius: isMenuOpen ? '8px 8px 0 0' : '8px',
        paddingLeft: '38px',
        textTransform: 'uppercase',
        fontSize: '20px',
        padding: '10px 0 10px 38px',
        color: 'white',
        display: 'flex',
        flexDirection: 'row',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {ressources[selected].name}
      <div className="flex items-center h-full">
        <div
          className="h-full"
          style={{ backgroundColor: 'white', width: '1px' }}
        />
        <icons.ChevronDown
          style={{
            height: '40px',
            width: '40px',
            fill: 'white',
            transition: 'transform 0.2s',
            transformOrigin: 'center',
            transform: isMenuOpen ? 'rotate(90deg)' : undefined,
          }}
        />
      </div>
      {isMenuOpen && (
        <div
          className="absolute w-full"
          style={{ left: 0, top: '100%', margin: 0 }}
          onClick={() => {
            setIsMenuOpen(false);
          }}
        >
          {ressources
            .filter((ressource) => ressource.id !== selected)
            .map((ressource) => (
              <div
                key={ressource.id}
                onClick={() => setSelected(ressource.id)}
                className="cursor-pointer flex items-center justify-between"
                style={{
                  transition: 'all 0.2s',
                  color: 'white',
                  height: '72px',
                  width: '100%',
                  paddingLeft: '38px',
                  textTransform: 'uppercase',
                  fontSize: '20px',
                  padding: '10px 0 10px 38px',
                  backgroundColor: ressource.color,
                }}
              >
                {ressource.name}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
