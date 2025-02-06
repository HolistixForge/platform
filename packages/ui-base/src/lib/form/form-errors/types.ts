export type TFormErrors<T = unknown> = Partial<{
  [Property in keyof T | 'global']: string;
}>;

export type TFormSubmitHandler<T> = (data: T) => void;

export class FormErrorsError extends Error {
  json: {
    errors: TFormErrors<{ [k: string]: string }>;
  };

  constructor() {
    super();
    this.json = { errors: {} };
  }

  add(field: string, message: string) {
    this.json.errors[field] = message;
  }

  hasErrors() {
    return Object.keys(this.json.errors).length > 0;
  }
}
