export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue; }
export type JSONArray = JSONValue[];

export interface ParserOptions {
  onNewEntry: (entry: JSONValue) => void;
}

export type StringToken = { type: 'string'; value: string };
export type NumberToken = { type: 'number'; value: number };
export type ValueToken = { type: 'value'; value: boolean | null };

export type Token =
  | { type: 'begin-object' }
  | { type: 'end-object' }
  | { type: 'begin-array' }
  | { type: 'end-array' }
  | { type: 'name-separator' } // :
  | { type: 'value-separator' } // ,
  | StringToken
  | NumberToken
  | ValueToken; 