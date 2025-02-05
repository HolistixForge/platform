import { TFormErrors } from './types';

type TApiError = {
  message: string;
};

/**
 * extract errors from an Error coming back from API call.
 * @param error
 */

export const standardizeError = (error: any): TFormErrors | false => {
  const r: { [k: string]: string } = {};
  if (error.json) {
    // if it is an error from express-openapi-validator:
    if (
      error.json.name === 'Bad Request' &&
      error.json.status === 400 &&
      Array.isArray(error.json.errors)
    ) {
      error.json.errors.forEach((f: { path: string; message: string }) => {
        const path = f.path.split('/');
        const field = path.pop() as string;
        r[field] = r[field]
          ? `${r[field]}. ${field} ${f.message}`
          : `${field} ${f.message}`;
      });
      return r;
    }
    // if it is an error from Api logic
    else if (Array.isArray(error.json.errors)) {
      r['global'] = error.json.errors
        .map((e: TApiError) => e.message)
        .join('. ');
    }
    //
    else if (typeof error.json.errors === 'object') {
      Object.keys(error.json.errors).forEach((key) => {
        r[key] = error.json.errors[key];
      });
    }
  }
  // else, any other error
  else {
    r['global'] = error.message;
  }

  return Object.keys(r).length > 0 ? r : false;
};

/**
 * join all errors message in a single string.
 */
export const errorsJoin = (errors: TFormErrors) => {
  return Object.keys(errors)
    .map((f) => (errors as { [k: string]: string })[f])
    .join('. ');
};
