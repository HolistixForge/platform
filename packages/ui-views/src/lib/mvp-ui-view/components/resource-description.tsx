import { useEffect, useState } from 'react';

import { icons } from '@monorepo/demiurge-ui-components';

//

type ResourceDescriptionProps = {
  editing: boolean;
};

export const ResourceDescription = ({ editing }: ResourceDescriptionProps) => {
  const [_editing, _setEditing] = useState(editing);

  useEffect(() => {
    _setEditing(editing);
  }, [editing]);

  return (
    <div className="flex flex-col min-w-[390px]">
      <div className="flex items-center justify-between bg-[#2A2A3F] h-[36px] rounded-t-[4px] px-[10px]">
        <p className="text-white text-[16px] font-bold leading-[28px]">
          Description
        </p>
        <div className="cursor-pointer" onClick={() => _setEditing(!_editing)}>
          {_editing ? <icons.Editing /> : <icons.Edit />}
        </div>
      </div>
      <div
        className={`${
          _editing ? 'description-gradient' : ''
        } p-px rounded-b-[4px]`}
      >
        <div className="bg-[#141432] px-[12px] py-[15px] rounded-b-[4px]">
          {_editing ? (
            <textarea
              className="w-full min-h-[600px] bg-[#141432] text-white text-[12px] leading-[17px] resize-none outline-none"
              placeholder="Description"
              defaultValue={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam
              imperdiet fringilla neque, in vehicula lorem varius vel. Curabitur
              ac diam at felis scelerisque ullamcorper vel id purus. Integer
              imperdiet turpis velit, a sollicitudin lorem varius sed. In
              fringilla sem a elit convallis, vel aliquam turpis condimentum.
              Donec lobortis sed ipsum euismod ultricies. Integer eget nibh et
              velit accumsan consectetur quis ac risus. Pellentesque malesuada
              nulla libero, id tristique nisi vehicula et. tincidunt vulputate
              eget Sed vitae justo aliquet, ornare augue ac, lobortis enim.
              Nullam facilisis orci nec ultricies rutrum. Nunc tincidunt metus a
              diam egestas, eget fringilla neque ullamcorper. Integer vel
              volutpat justo, maximus posuere magna. Sed scelerisque ligula id
              ex aliquet varius. In vulputate, libero sit amet placerat
              fermentum, orci augue lobortis risus, sit amet fringilla ante ex
              eget urna. Vivamus in dignissim tortor, et placerat neque. Sed
              tempus pellentesque urna at gravida. Suspendisse id nibh
              consequat, sagittis tortor id, convallis turpis. Nam nisl neque,
              malesuada quis dignissim a, hendrerit nec mauris. Duis eget mauris
              ligula. Class aptent taciti sociosqu ad litora torquent per
              conubia nostra, per inceptos himenaeos. In vel feugiat magna, sit
              amet lobortis quam. Suspendisse eget felis feugiat, lacinia orci
              non, molestie urna. Nam efficitur magna leo,`}
            />
          ) : (
            <p className="text-[12px] text-white leading-[17px]">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam
              imperdiet fringilla neque, in vehicula lorem varius vel. Curabitur
              ac diam at felis scelerisque ullamcorper vel id purus. Integer
              imperdiet turpis velit, a sollicitudin lorem varius sed. In
              fringilla sem a elit convallis, vel aliquam turpis condimentum.
              Donec lobortis sed ipsum euismod ultricies. Integer eget nibh et
              velit accumsan consectetur quis ac risus. Pellentesque malesuada
              nulla libero, id tristique nisi vehicula et. tincidunt vulputate
              eget Sed vitae justo aliquet, ornare augue ac, lobortis enim.
              Nullam facilisis orci nec ultricies rutrum. Nunc tincidunt metus a
              diam egestas, eget fringilla neque ullamcorper. Integer vel
              volutpat justo, maximus posuere magna. Sed scelerisque ligula id
              ex aliquet varius. In vulputate, libero sit amet placerat
              fermentum, orci augue lobortis risus, sit amet fringilla ante ex
              eget urna. Vivamus in dignissim tortor, et placerat neque. Sed
              tempus pellentesque urna at gravida. Suspendisse id nibh
              consequat, sagittis tortor id, convallis turpis. Nam nisl neque,
              malesuada quis dignissim a, hendrerit nec mauris. Duis eget mauris
              ligula. Class aptent taciti sociosqu ad litora torquent per
              conubia nostra, per inceptos himenaeos. In vel feugiat magna, sit
              amet lobortis quam. Suspendisse eget felis feugiat, lacinia orci
              non, molestie urna. Nam efficitur magna leo,
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
