export type TJson =
  | string
  | number
  | boolean
  | Date
  | { [x: string]: TJson }
  | Array<TJson>;
