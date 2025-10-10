export type TStringMap = {
  [k: string]: string;
}; // Recursive JSON type definition - more permissive to handle both
// index signatures and objects with specific properties
export type TJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: TJson }
  | TJson[];

export type TJsonObject = { [key: string]: TJson };

//

export type TJsonArray = TJson[];

//

export type TJsonWithDate =
  | string
  | number
  | boolean
  | null
  | Date
  | { [key: string]: TJsonWithDate }
  | TJsonWithDate[];

//

export type TJsonWithUndefined =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: TJsonWithUndefined }
  | TJsonWithUndefined[];
