import { Token, JSONValue, JSONObject, JSONArray } from './types.ts';
import { Lexer } from './lexer.ts';

export class Parser {
  private lexer: Lexer;

  constructor() {
    this.lexer = new Lexer();
  }

  parse(input: string): JSONValue {
    this.lexer.addChunk(input);
    const value = this.parseValue();
    
    if (value === undefined) {
      throw new Error('Invalid JSON');
    }
    
    return value;
  }

  private parseValue(): JSONValue | undefined {
    const token = this.nextSignificantToken();
    if (!token) return undefined;

    if (token.type === 'string' || token.type === 'number' || token.type === 'value') {
      return token.value;
    }

    if (token.type === 'begin-object') {
      return this.parseObject();
    }

    if (token.type === 'begin-array') {
      return this.parseArray();
    }

    return undefined;
  }

  private parseObject(): JSONObject | undefined {
    const obj: JSONObject = {};

    // Handle empty object
    const nextToken = this.nextSignificantToken(true);
    if (nextToken?.type === 'end-object') {
      this.nextSignificantToken(); // consume the }
      return obj;
    }

    while (true) {
      // Parse the key
      const keyToken = this.nextSignificantToken();
      if (!keyToken || keyToken.type !== 'string') {
        return undefined;
      }

      // Expect name-separator
      const colonToken = this.nextSignificantToken();
      if (!colonToken || colonToken.type !== 'name-separator') {
        return undefined;
      }

      // Parse the value
      const value = this.parseValue();
      if (value === undefined) {
        return undefined;
      }

      obj[keyToken.value] = value;

      // Check for value-separator or end of object
      const separatorToken = this.nextSignificantToken();
      if (!separatorToken) {
        return undefined;
      }

      if (separatorToken.type === 'end-object') {
        return obj;
      }

      if (separatorToken.type !== 'value-separator') {
        return undefined;
      }
    }
  }

  private parseArray(): JSONArray | undefined {
    const arr: JSONArray = [];

    // Handle empty array
    const nextToken = this.nextSignificantToken(true);
    if (nextToken?.type === 'end-array') {
      this.nextSignificantToken(); // consume the ]
      return arr;
    }

    while (true) {
      const value = this.parseValue();
      if (value === undefined) {
        return undefined;
      }

      arr.push(value);

      const separatorToken = this.nextSignificantToken();
      if (!separatorToken) {
        return undefined;
      }

      if (separatorToken.type === 'end-array') {
        return arr;
      }

      if (separatorToken.type !== 'value-separator') {
        return undefined;
      }
    }
  }

  private nextSignificantToken(peek = false): Token | null {
    const token = this.lexer.nextToken();
    if (peek && token) {
      this.lexer.setPosition(this.lexer.getPosition() - 1);
    }
    return token;
  }
}
