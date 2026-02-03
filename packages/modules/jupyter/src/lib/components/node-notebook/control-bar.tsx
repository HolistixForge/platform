import { useState } from 'react';

import { icons } from '@holistix-forge/ui-base';

//

export const ControlBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedArrow, setSelectedArrow] = useState<
    'top' | 'bottom' | 'left' | 'right'
  >('right');
  const [childArrowHovered, setChildArrowHovered] = useState<boolean>(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div
      className="flex items-center"
      style={{
        borderRadius: '50px',
        border: '1px solid #C4C4C4',
        paddingRight: '30px',
        height: '64px',
        backgroundColor: 'var(--surface-900)',
      }}
    >
      <div
        className="h-full flex items-center justify-center relative group"
        style={{
          paddingRight: '20px',
          paddingLeft: '30px',
          borderRadius: '50px 0 0 50px',
        }}
      >
        <icons.Plus
          className="cursor-pointer relative"
          style={{ height: '24px', width: '24px', zIndex: 20 }}
        />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-addToolbar w-full"
          style={{ height: '62px', left: 0, top: 0, zIndex: 10 }}
        />
      </div>
      <div
        onClick={toggleMenu}
        className="relative h-full cursor-pointer group/list"
      >
        <div
          className={`absolute opacity-0 group-hover/list:opacity-100 transition-opacity bg-toolbar-tertiary ${
            childArrowHovered && isMenuOpen ? 'hidden' : ''
          }`}
          style={{
            height: '62px',
            backgroundSize: 'contain',
            width: '98%',
            left: 0,
            top: 0,
          }}
        />
        {isMenuOpen && (
          <ul
            className="absolute w-full flex items-center justify-center flex-col"
            style={{
              bottom: '100%',
              left: 0,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'var(--surface-900)',
            }}
          >
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className="flex items-center w-full justify-center relative group transition-all"
              style={{
                height: '60px',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              onClick={() => setSelectedArrow('top')}
            >
              <icons.RoundedArrowTop
                style={{ height: '24px', width: '24px' }}
              />
              <div
                className="absolute w-full opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar-tertiary"
                style={{
                  height: '62px',
                  backgroundSize: 'cover',
                  left: 0,
                  top: 0,
                }}
              />
            </li>
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className="flex items-center w-full justify-center relative group transition-all"
              style={{
                height: '60px',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              onClick={() => setSelectedArrow('left')}
            >
              <icons.RoundedArrowLeft
                style={{ height: '24px', width: '24px' }}
              />
              <div
                className="absolute w-full opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar-tertiary"
                style={{
                  height: '62px',
                  backgroundSize: 'cover',
                  left: 0,
                  top: 0,
                }}
              />
            </li>
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className="flex items-center w-full justify-center relative group transition-all"
              style={{
                height: '60px',
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              onClick={() => setSelectedArrow('bottom')}
            >
              <icons.RoundedArrowDown
                style={{ height: '24px', width: '24px' }}
              />
              <div
                className="absolute w-full opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar-tertiary"
                style={{
                  height: '62px',
                  backgroundSize: 'cover',
                  left: 0,
                  top: 0,
                }}
              />
            </li>
          </ul>
        )}
        <div
          className="flex items-center justify-center h-full"
          style={{
            padding: '0 7px',
            borderLeft: '1px solid var(--neutral-9)',
            borderRight: '2px solid',
          }}
        >
          {selectedArrow === 'top' ? (
            <icons.RoundedArrowTop
              style={{ height: '24px', width: '24px', marginBottom: '16px' }}
            />
          ) : selectedArrow === 'left' ? (
            <icons.RoundedArrowLeft
              style={{ height: '24px', width: '24px', marginBottom: '16px' }}
            />
          ) : selectedArrow === 'bottom' ? (
            <icons.RoundedArrowDown
              style={{ height: '24px', width: '24px', marginBottom: '16px' }}
            />
          ) : (
            <icons.RoundedArrowRight
              style={{ height: '24px', width: '24px', marginBottom: '16px' }}
            />
          )}
          <icons.ChevronDown
            className="absolute fill-neutral-dark transition-all"
            style={{
              bottom: 0,
              ...(isMenuOpen ? { transform: 'rotate(180deg)' } : {}),
            }}
          />
        </div>
      </div>
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.MediaPlay style={{ width: '28px', height: '28px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{
            height: '62px',
            backgroundSize: 'contain',
            width: '64px',
            left: '-0.16rem',
            top: 0,
          }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '34px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.Reload style={{ width: '24px', height: '24px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '34px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.FastForward style={{ width: '24px', height: '24px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '34px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.Stop style={{ width: '18px', height: '18px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '52px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.Cissors style={{ width: '23px', height: '23px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '34px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.Copy style={{ width: '18px', height: '18px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
      <div
        style={{
          backgroundColor: 'var(--neutral-9)',
          width: '2px',
          height: '34px',
          borderRadius: '9999px',
        }}
      />
      <div
        className="cursor-pointer h-full flex items-center justify-center relative group"
        style={{ width: '59px' }}
      >
        <icons.Past style={{ width: '18px', height: '18px' }} />
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-toolbar"
          style={{ height: '62px', width: '64px', left: '-0.175rem', top: 0 }}
        />
      </div>
    </div>
  );
};
