import { Token, JSONValue, JSONObject, JSONArray, ParserOptions } from './types.ts';
import { Lexer } from './lexer.ts';

type ParserState = {
  type: 'EXPECT_OBJECT_START'
} | {
  type: 'SCANNING_FOR_RESULTS'
} | {
  type: 'EXPECT_COLON_AFTER_RESULTS'
} | {
  type: 'EXPECT_ARRAY_START'
} | {
  type: 'PARSING_RESULTS_ARRAY'
} | {
  type: 'PARSING_ARRAY_ENTRY'
  bracketCount: number
  startPosition: number
} | {
  type: 'DONE'
};

export class StreamingJSONParser {
  private lexer: Lexer;
  private state: ParserState = { type: 'EXPECT_OBJECT_START' };
  private onNewEntry: (entry: JSONValue) => void;

  constructor(options: ParserOptions) {
    this.lexer = new Lexer();
    this.onNewEntry = options.onNewEntry;
  }

  async parseStream(stream: ReadableStream<string>) {
    const reader = stream.getReader();

    let done = false;
    while (!done) {
      const { value, done: isDone } = await reader.read();
      if (isDone) {
        done = true;
      } else if (value) {
        this.parseChunk(value);
      }
    }
  }

  private parseChunk(chunk: string) {
    this.lexer.addChunk(chunk);

    let madeProgress = true;
    while (madeProgress) {
      const oldPosition = this.lexer.getPosition();
      madeProgress = this.processNextStep();
      if (madeProgress && this.lexer.getPosition() === oldPosition) {
        madeProgress = false;
      }
    }
  }

  private processNextStep(): boolean {
    const token = this.nextSignificantToken(true);
    if (!token) return false;
    
    switch (this.state.type) {
      case 'EXPECT_OBJECT_START':
        return this.handleExpectObjectStart(token);
      case 'SCANNING_FOR_RESULTS':
        return this.handleScanningForResults(token);
      case 'EXPECT_COLON_AFTER_RESULTS':
        return this.handleExpectColon(token);
      case 'EXPECT_ARRAY_START':
        return this.handleExpectArrayStart(token);
      case 'PARSING_RESULTS_ARRAY':
        return this.handleParsingResultsArray(token);
      case 'PARSING_ARRAY_ENTRY':
        return this.handleParsingArrayEntry();
      case 'DONE':
        return false;
    }
  }

  private handleExpectObjectStart(token: Token): boolean {
    if (token.type !== 'begin-object') {
      return false;
    }
    this.nextSignificantToken(); // consume the token
    this.state = { type: 'SCANNING_FOR_RESULTS' };
    return true;
  }

  private handleScanningForResults(token: Token): boolean {
    this.nextSignificantToken(); // consume the peeked token
    
    if (token.type === 'string' && token.value === 'results') {
      this.state = { type: 'EXPECT_COLON_AFTER_RESULTS' };
      return true;
    }

    // Skip this key-value pair
    if (!this.expectToken('name-separator')) return false;
    if (!this.skipValue()) return false;

    const sep = this.nextSignificantToken();
    if (!sep) return false;

    if (sep.type === 'end-object') {
      this.state = { type: 'DONE' };
      return true;
    }

    if (sep.type !== 'value-separator') {
      return false;
    }

    return true;
  }

  private handleExpectColon(token: Token): boolean {
    if (token.type !== 'name-separator') {
      return false;
    }
    this.nextSignificantToken(); // consume the token
    this.state = { type: 'EXPECT_ARRAY_START' };
    return true;
  }

  private handleExpectArrayStart(token: Token): boolean {
    if (token.type !== 'begin-array') {
      return false;
    }
    this.nextSignificantToken(); // consume the token
    this.state = { type: 'PARSING_RESULTS_ARRAY' };
    return true;
  }

  private handleParsingResultsArray(token: Token): boolean {
    if (token.type === 'end-array') {
      this.nextSignificantToken(); // consume the token
      this.state = { type: 'DONE' };
      return true;
    }

    if (token.type === 'value-separator') {
      this.nextSignificantToken(); // consume the token
      return true;
    }

    if (token.type === 'begin-object') {
      // Start collecting a new object
      this.state = { 
        type: 'PARSING_ARRAY_ENTRY',
        bracketCount: 1,
        startPosition: this.lexer.getPosition()
      };
      this.nextSignificantToken(); // consume the opening brace
      return true;
    }

    return false;
  }

  private handleParsingArrayEntry(): boolean {
    if (this.state.type !== 'PARSING_ARRAY_ENTRY') return false;

    const token = this.nextSignificantToken();
    if (!token) return false;

    if (token.type === 'begin-object') {
      this.state.bracketCount++;
      return true;
    } 
      
    if (token.type === 'end-object') {
      this.state.bracketCount--;
        
      if (this.state.bracketCount === 0) {
        // We have a complete object
        const objectStr = this.lexer.getBuffer().slice(
          this.state.startPosition, 
          this.lexer.getPosition()
        );

        try {
          const parsedObject = JSON.parse(objectStr);
          this.onNewEntry(parsedObject);
          this.state = { type: 'PARSING_RESULTS_ARRAY' };
          return true;
        } catch (e) {
          console.error('StreamingJSONParser - Error parsing JSON', e);
          return false;
        }
      }
    }

    return true;
  }

  private nextSignificantToken(peek = false): Token | null {
    const oldPos = this.lexer.getPosition();
    const token = this.lexer.nextToken();
    if (peek && token !== null) {
      this.lexer.setPosition(oldPos);
    }
    return token;
  }

  private expectToken(type: Token['type']): boolean {
    const token = this.nextSignificantToken();
    if (!token || token.type !== type) {
      return false;
    }
    return true;
  }

  private skipValue(): boolean {
    const value = this.parseValue(true);
    return value !== undefined;
  }

  private parseValue(discard = false): JSONValue | undefined {
    const token = this.nextSignificantToken();
    if (!token) return undefined;

    if (token.type === 'string' || token.type === 'number' || token.type === 'value') {
      if (discard) return {};
      return token.value;
    }

    if (token.type === 'begin-object') {
      return this.parseObject(discard);
    }

    if (token.type === 'begin-array') {
      return this.parseArray(discard);
    }

    return undefined;
  }

  private parseObject(discard: boolean): JSONValue | undefined {
    const obj: JSONObject = {};

    // Handle empty object
    const nextToken = this.nextSignificantToken(true);
    if (!nextToken) return undefined;
    if (nextToken.type === 'end-object') {
      this.nextSignificantToken(); // consume '}'
      return discard ? {} : obj;
    }

    // Parse key-value pairs
    while (true) {
      const keyToken = this.nextSignificantToken();
      if (!keyToken || keyToken.type !== 'string') return undefined;
      const key = keyToken.value;

      if (!this.expectToken('name-separator')) return undefined;

      const value = this.parseValue(discard);
      if (value === undefined) return undefined;

      if (!discard) {
        obj[key] = value;
      }

      const separator = this.nextSignificantToken();
      if (!separator) return undefined;

      if (separator.type === 'end-object') {
        return discard ? {} : obj;
      }

      if (separator.type !== 'value-separator') {
        return undefined;
      }
    }
  }

  private parseArray(discard: boolean): JSONValue | undefined {
    const arr: JSONArray = [];

    // Handle empty array
    const nextToken = this.nextSignificantToken(true);
    if (!nextToken) return undefined;
    if (nextToken.type === 'end-array') {
      this.nextSignificantToken(); // consume ']'
      return discard ? [] : arr;
    }

    while (true) {
      const value = this.parseValue(discard);
      if (value === undefined) return undefined;

      if (!discard) {
        arr.push(value);
      }

      const separator = this.nextSignificantToken();
      if (!separator) return undefined;

      if (separator.type === 'end-array') {
        return discard ? [] : arr;
      }

      if (separator.type !== 'value-separator') {
        return undefined;
      }
    }
  }
}
