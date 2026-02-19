import { useEffect, useState } from 'react';

import { icons } from '@holistix-forge/ui-base';

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
    <div className="flex flex-col" style={{ minWidth: '390px' }}>
      <div
        className="flex items-center justify-between"
        style={{
          backgroundColor: '#2A2A3F',
          height: '36px',
          borderRadius: '4px 4px 0 0',
          padding: '0 10px',
        }}
      >
        <p
          className="font-bold"
          style={{ color: 'white', fontSize: '16px', lineHeight: '28px' }}
        >
          Description
        </p>
        <div className="cursor-pointer" onClick={() => _setEditing(!_editing)}>
          {_editing ? <icons.Editing /> : <icons.Edit />}
        </div>
      </div>
      <div
        className={_editing ? 'description-gradient' : ''}
        style={{ padding: '1px', borderRadius: '0 0 4px 4px' }}
      >
        <div
          style={{
            backgroundColor: '#141432',
            padding: '15px 12px',
            borderRadius: '0 0 4px 4px',
          }}
        >
          {_editing ? (
            <textarea
              className="w-full"
              style={{
                minHeight: '600px',
                backgroundColor: '#141432',
                color: 'white',
                fontSize: '12px',
                lineHeight: '17px',
                resize: 'none',
                outline: 'none',
              }}
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
            <p style={{ fontSize: '12px', color: 'white', lineHeight: '17px' }}>
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
