export type TJson =
  | string
  | number
  | boolean
  | Date
  | { [x: string]: TJson }
  | Array<TJson>;

export type TJsonWithNull =
  | string
  | number
  | boolean
  | Date
  | null
  | { [x: string]: TJsonWithNull }
  | Array<TJsonWithNull>;
