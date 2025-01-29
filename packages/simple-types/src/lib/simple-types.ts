export type TJson = string | number | boolean | null | TJsonObject | TJsonArray;
export type TJsonObject = { [key: string]: TJson };
export type TJsonArray = TJson[];

export type TJsonWithDate =
  | Date
  | string
  | number
  | boolean
  | null
  | TJsonObjectWithDate
  | TJsonArrayWithDate;
type TJsonObjectWithDate = { [key: string]: TJsonWithDate };
type TJsonArrayWithDate = TJsonWithDate[];
