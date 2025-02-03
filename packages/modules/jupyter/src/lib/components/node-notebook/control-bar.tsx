import { icons } from '../../assets/icons';
import { useState } from 'react';

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
    <div className="flex items-center rounded-[50px] border border-[#C4C4C4] -bg--c-blue-gray-0 pr-[30px] h-[64px]">
      <div className="pr-5 pl-[30px] h-full flex items-center justify-center relative group active:-bg--c-blue-gray-3 rounded-l-[50px]">
        <icons.Plus className="h-[24px] w-[24px] cursor-pointer relative z-20" />
        <div className="absolute h-[62px] bg-addToolbar w-full left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
      </div>
      <div
        onClick={toggleMenu}
        className="relative h-full cursor-pointer group/list"
      >
        <div className={`absolute h-[62px] bg-contain bg-toolbar-tertiary w-[98%] left-0 top-0 opacity-0 group-hover/list:opacity-100 transition-opacity ${childArrowHovered && isMenuOpen ? "hidden" : ""}`} />
        {isMenuOpen && (
          <ul className="absolute bottom-full left-0 w-full flex items-center justify-center flex-col -bg--c-blue-gray-0 border border-white border-opacity-20">
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className={`h-[60px] flex items-center w-full justify-center border-white border-opacity-20 hover:border-opacity-100 border-r transition-all relative group`}
              onClick={() => setSelectedArrow('top')}
            >
              <icons.RoundedArrowTop className="h-[24px] w-[24px]" />
              <div className="absolute h-[62px] bg-cover bg-toolbar-tertiary w-full left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </li>
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className={`h-[60px] flex items-center w-full justify-center border-white border-opacity-20 hover:border-opacity-100 border-r transition-all relative group`}
              onClick={() => setSelectedArrow('left')}
            >
              <icons.RoundedArrowLeft className="h-[24px] w-[24px]" />
              <div className="absolute h-[62px] bg-cover bg-toolbar-tertiary w-full left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </li>
            <li
              onMouseEnter={() => setChildArrowHovered(true)}
              onMouseLeave={() => setChildArrowHovered(false)}
              className={`h-[60px] flex items-center w-full justify-center border-white border-opacity-20 hover:border-opacity-100 border-r transition-all relative group`}
              onClick={() => setSelectedArrow('bottom')}
            >
              <icons.RoundedArrowDown className="h-[24px] w-[24px]" />
              <div className="absolute h-[62px] bg-cover bg-toolbar-tertiary w-full left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </li>
          </ul>
        )}
        <div className={`flex items-center justify-center h-full px-[7px] -border-l--c-white-2 border-l border-r-[2px]`}>
          {selectedArrow === 'top' ? (
            <icons.RoundedArrowTop className="h-[24px] w-[24px] mb-4" />
          ) : selectedArrow === 'left' ? (
            <icons.RoundedArrowLeft className="h-[24px] w-[24px] mb-4" />
          ) : selectedArrow === 'bottom' ? (
            <icons.RoundedArrowDown className="h-[24px] w-[24px] mb-4" />
          ) : (
            <icons.RoundedArrowRight className="h-[24px] w-[24px] mb-4" />
          )}
          <icons.ChevronDown
            className={`absolute bottom-0 fill--c-gray-11 ${
              isMenuOpen ? 'rotate-180' : ''
            } transition-all`}
          />
        </div>
      </div>
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.MediaPlay className="w-[28px] h-[28px]" />
        <div className="absolute h-[62px] bg-contain bg-toolbar w-[64px] -left-[.16rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[34px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.Reload className="w-[24px] h-[24px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[34px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.FastForward className="w-[24px] h-[24px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[34px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.Stop className="w-[18px] h-[18px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[52px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.Cissors className="w-[23px] h-[23px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[34px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.Copy className="w-[18px] h-[18px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="w-[2px] h-[34px] -bg--c-alt-gray-1 rounded-full" />
      <div className="cursor-pointer h-full w-[59px] flex items-center justify-center relative group active:-bg--c-blue-gray-3">
        <icons.Past className="w-[18px] h-[18px]" />
        <div className="absolute h-[62px] bg-toolbar w-[64px] -left-[.175rem] top-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
