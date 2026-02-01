import { useEffect, useState } from 'react';

import { icons } from '@holistix-forge/ui-base';

//

type UserInformationsProps = {
  editing?: boolean;
};

export const UserInformations = ({ editing }: UserInformationsProps) => {
  const [_editing, _setEditing] = useState(editing);

  useEffect(() => {
    _setEditing(editing);
  }, [editing]);

  return (
    <div className="flex flex-col" style={{ width: '445px' }}>
      <div
        className="flex items-center justify-between"
        style={{
          backgroundColor: '#2A2A3F',
          height: '40px',
          borderRadius: '4px',
          padding: '0 10px',
        }}
      >
        <p
          className="font-bold"
          style={{ color: 'white', fontSize: '16px', lineHeight: '28px' }}
        >
          Informations
        </p>
        <div className="cursor-pointer" onClick={() => _setEditing(!_editing)}>
          {_editing ? <icons.Editing /> : <icons.Edit />}
        </div>
      </div>
      <div
        className="flex flex-col"
        style={{
          paddingLeft: _editing ? '13px' : '32px',
          paddingRight: _editing ? '13px' : '32px',
          paddingTop: '15px',
          paddingBottom: '15px',
          gap: '30px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            className="font-bold"
            style={{ color: 'white', fontSize: '14px' }}
          >
            First Name
          </label>
          {_editing ? (
            <input
              className="w-full"
              style={{
                height: '42px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '28px',
                borderRadius: '4px',
                padding: '0 10px',
                border: '1px solid #833A9D',
              }}
              placeholder="First Name"
              defaultValue="John"
            />
          ) : (
            <p
              style={{
                color: 'white',
                fontSize: '14px',
                paddingLeft: '8px',
                lineHeight: '28px',
              }}
            >
              John
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            className="font-bold"
            style={{ color: 'white', fontSize: '14px' }}
          >
            Last Name
          </label>
          {_editing ? (
            <input
              className="w-full"
              style={{
                height: '42px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '28px',
                borderRadius: '4px',
                padding: '0 10px',
                border: '1px solid #833A9D',
              }}
              placeholder="Last Name"
              defaultValue="Doe"
            />
          ) : (
            <p
              style={{
                color: 'white',
                fontSize: '14px',
                paddingLeft: '8px',
                lineHeight: '28px',
              }}
            >
              Doe
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            className="font-bold"
            style={{ color: 'white', fontSize: '14px' }}
          >
            Mail
          </label>
          {_editing ? (
            <input
              className="w-full"
              style={{
                height: '42px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '28px',
                borderRadius: '4px',
                padding: '0 10px',
                border: '1px solid #833A9D',
              }}
              placeholder="Mail"
              defaultValue="john.doe@gmail.com"
              type="email"
            />
          ) : (
            <p
              style={{
                color: 'white',
                fontSize: '14px',
                paddingLeft: '8px',
                lineHeight: '28px',
              }}
            >
              john.doe@gmail.com
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            className="font-bold"
            style={{ color: 'white', fontSize: '14px' }}
          >
            Password
          </label>
          {_editing ? (
            <input
              className="w-full"
              style={{
                height: '42px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '28px',
                borderRadius: '4px',
                padding: '0 10px',
                border: '1px solid #833A9D',
              }}
              placeholder="Password"
              defaultValue="123456789"
              type="password"
            />
          ) : (
            <p
              style={{
                color: 'white',
                fontSize: '14px',
                paddingLeft: '8px',
                lineHeight: '28px',
              }}
            >
              123456789
            </p>
          )}
        </div>

        {_editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              className="font-bold"
              style={{ color: 'white', fontSize: '14px' }}
            >
              Confirm Password
            </label>
            <input
              className="w-full"
              style={{
                height: '42px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '28px',
                borderRadius: '4px',
                padding: '0 10px',
                border: '1px solid #833A9D',
              }}
              placeholder="Confirm Password"
              defaultValue="123456789"
              type="password"
            />
          </div>
        )}
      </div>
    </div>
  );
};
