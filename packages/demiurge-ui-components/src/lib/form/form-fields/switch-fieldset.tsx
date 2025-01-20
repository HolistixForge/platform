import './switch-fieldset.scss';


//
//
//

export const SwitchFieldset = ({
    value,
    onChange,
    label,
    name,
  }: {
    label: string;
    name: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => {
    return (
      <fieldset className="switch-fieldset">
        <label htmlFor={name} className="Label">
          <input
            onChange={() => onChange(!value)}
            checked={value}
            type="checkbox"
            id={name}
            name={name}
          />
          <span />
          <p className={value ? 'switch-active' : ''}>{label}</p>
        </label>
      </fieldset>
    );
  };