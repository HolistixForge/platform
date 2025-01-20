import { useEffect, useState } from 'react';
import { icons } from '../../assets/icons';

interface UserInformationsProps {
  editing?: boolean;
}

export const UserInformations = ({ editing }: UserInformationsProps) => {
  const [_editing, _setEditing] = useState(editing);

  useEffect(() => {
    _setEditing(editing);
  }, [editing]);

  return (
    <div className="flex flex-col w-[445px]">
      <div className="flex items-center justify-between bg-[#2A2A3F] h-[40px] rounded-[4px] px-[10px]">
        <p className="text-white text-[16px] font-bold leading-[28px]">
          Informations
        </p>
        <div className="cursor-pointer" onClick={() => _setEditing(!_editing)}>
          {_editing ? <icons.Editing /> : <icons.Edit />}
        </div>
      </div>
      <div
        className={`${
          _editing ? 'px-[13px]' : 'px-[32px]'
        } py-[15px] flex flex-col gap-[30px]`}
      >
        <div className="space-y-1">
          <label className="text-white text-[14px] font-bold">First Name</label>
          {_editing ? (
            <input
              className="w-full h-[42px] text-white text-[14px] placeholder:text-[#7E7E93] leading-[28px] rounded-[4px] px-[10px]"
              placeholder="First Name"
              defaultValue="John"
              style={{
                border: '1px solid #833A9D',
              }}
            />
          ) : (
            <p className="text-white text-[14px] pl-2 leading-[28px]">John</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-white text-[14px] font-bold">Last Name</label>
          {_editing ? (
            <input
              className="w-full h-[42px] text-white text-[14px] placeholder:text-[#7E7E93] leading-[28px] rounded-[4px] px-[10px]"
              placeholder="Last Name"
              defaultValue="Doe"
              style={{
                border: '1px solid #833A9D',
              }}
            />
          ) : (
            <p className="text-white text-[14px] pl-2 leading-[28px]">Doe</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-white text-[14px] font-bold">Mail</label>
          {_editing ? (
            <input
              className="w-full h-[42px] text-white text-[14px] placeholder:text-[#7E7E93] leading-[28px] rounded-[4px] px-[10px]"
              placeholder="Mail"
              defaultValue="john.doe@gmail.com"
              style={{
                border: '1px solid #833A9D',
              }}
              type="email"
            />
          ) : (
            <p className="text-white text-[14px] pl-2 leading-[28px]">
              john.doe@gmail.com
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-white text-[14px] font-bold">Password</label>
          {_editing ? (
            <input
              className="w-full h-[42px] text-white text-[14px] placeholder:text-[#7E7E93] leading-[28px] rounded-[4px] px-[10px]"
              placeholder="Password"
              defaultValue="123456789"
              style={{
                border: '1px solid #833A9D',
              }}
              type="password"
            />
          ) : (
            <p className="text-white text-[14px] pl-2 leading-[28px]">
              123456789
            </p>
          )}
        </div>

        {_editing && (
          <div className="space-y-1">
            <label className="text-white text-[14px] font-bold">
              Confirm Password
            </label>
            <input
              className="w-full h-[42px] text-white text-[14px] placeholder:text-[#7E7E93] leading-[28px] rounded-[4px] px-[10px]"
              placeholder="Confirm Password"
              defaultValue="123456789"
              style={{
                border: '1px solid #833A9D',
              }}
              type="password"
            />
          </div>
        )}
      </div>
    </div>
  );
};
