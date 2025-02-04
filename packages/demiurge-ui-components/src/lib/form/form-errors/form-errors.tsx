import { TFormErrors } from './types';

import './form-errors.scss';

/**
 *
 * @param param0
 * @returns
 */

export const FormErrors = ({ errors }: { errors: TFormErrors<any> }) => {
  if (Object.keys(errors).length)
    return (
      <div className="form-errors">
        <ul>
          {Object.keys(errors).map((k) => (
            <li key={k}>
              <p key={k} className="form-error">
                {errors[k]}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  return null;
};

/**
 *
 * @param param0
 * @returns
 */
export const FormError = ({
  errors,
  id,
}: {
  errors: TFormErrors<any>;
  id: string;
}) => {
  if (errors[id]) return <p className="form-error">{errors[id]}</p>;
  return null;
};
