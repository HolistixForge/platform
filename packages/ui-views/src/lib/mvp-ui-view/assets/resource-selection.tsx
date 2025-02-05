import { useState, useEffect } from 'react';

import { icons } from '@monorepo/demiurge-ui-components';

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
      style={{ backgroundColor: ressources[selected].color }}
      className={`cursor-pointer flex flex-row space-x-4 text-white h-[72px] min-w-[388px] ${
        isMenuOpen ? 'rounded-b-none' : ''
      } rounded-lg pl-[38px] uppercase relative text-[20px] py-[10px] items-center justify-between`}
    >
      {ressources[selected].name}
      <div className="flex items-center h-full">
        <div className="h-full bg-white w-px" />
        <icons.ChevronDown
          className={`h-10 w-10 fill-white transition-transform origin-center ${
            isMenuOpen ? 'rotate-90' : ''
          }`}
        />
      </div>
      {isMenuOpen && (
        <div
          className="absolute w-full left-0 top-full !mx-0"
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
                className={`cursor-pointer hover:brightness-75 transition-all flex text-white h-[72px] w-full pl-[38px] uppercase text-[20px] py-[10px] items-center justify-between`}
                style={{ backgroundColor: ressource.color }}
              >
                {ressource.name}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
