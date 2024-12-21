import { Token } from './types.ts';

export class Lexer {
  private buffer = "";
  private position = 0;

  constructor() {}

  addChunk(chunk: string) {
    this.buffer += chunk;
  }

  getPosition(): number {
    return this.position;
  }

  setPosition(pos: number) {
    this.position = pos;
  }

  getBuffer(): string {
    return this.buffer;
  }

  nextToken(): Token | null {
    this.skipWhitespace();
    if (this.position >= this.buffer.length) return null;

    const ch = this.buffer[this.position];

    if (ch === '{') {
      this.position++;
      return { type: 'begin-object' };
    } else if (ch === '}') {
      this.position++;
      return { type: 'end-object' };
    } else if (ch === '[') {
      this.position++;
      return { type: 'begin-array' };
    } else if (ch === ']') {
      this.position++;
      return { type: 'end-array' };
    } else if (ch === ':') {
      this.position++;
      return { type: 'name-separator' };
    } else if (ch === ',') {
      this.position++;
      return { type: 'value-separator' };
    } else if (ch === '"') {
      return this.readString();
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      return this.readNumber();
    } else if (this.startsWith("true")) {
      this.position += 4;
      return { type: 'value', value: true };
    } else if (this.startsWith("false")) {
      this.position += 5;
      return { type: 'value', value: false };
    } else if (this.startsWith("null")) {
      this.position += 4;
      return { type: 'value', value: null };
    }

    return null;
  }

  private skipWhitespace() {
    while (this.position < this.buffer.length && /\s/.test(this.buffer[this.position])) {
      this.position++;
    }
  }

  private startsWith(s: string): boolean {
    return this.buffer.slice(this.position, this.position + s.length) === s;
  }

  private readString(): Token | null {
    const startPosition = this.position;
    this.position++; // skip opening quote

    let result = "";
    while (this.position < this.buffer.length) {
      const ch = this.buffer[this.position];
      if (ch === '\\') {
        if (this.position + 1 >= this.buffer.length) {
          this.position = startPosition;
          return null;
        }
        
        const esc = this.buffer[this.position + 1];
        switch (esc) {
          case 'n': result += '\n'; break;
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u': {
            if (this.position + 5 >= this.buffer.length) {
              this.position = startPosition;
              return null;
            }
            const hex = this.buffer.slice(this.position + 2, this.position + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this.position = startPosition;
              return null;
            }
            result += String.fromCharCode(parseInt(hex, 16));
            this.position += 5;
            break;
          }
          default:
            result += esc;
        }
        this.position += 2;
      } else if (ch === '"') {
        this.position++;
        return { type: 'string', value: result };
      } else {
        result += ch;
        this.position++;
      }
    }

    this.position = startPosition;
    return null;
  }

  private readNumber(): Token | null {
    const start = this.position;
    let hasDigit = false;
    let hasDecimal = false;
    let hasExponent = false;

    while (this.position < this.buffer.length) {
      const ch = this.buffer[this.position];

      if (ch >= '0' && ch <= '9') {
        hasDigit = true;
        this.position++;
      } else if (ch === '.' && !hasDecimal && !hasExponent) {
        hasDecimal = true;
        this.position++;
      } else if ((ch === 'e' || ch === 'E') && !hasExponent && hasDigit) {
        hasExponent = true;
        hasDigit = false; // reset digit check for exponent part
        this.position++;
        if (this.position < this.buffer.length && (this.buffer[this.position] === '+' || this.buffer[this.position] === '-')) {
          this.position++;
        }
      } else {
        break;
      }
    }

    // If we ran out of buffer, we can't be sure the number is complete.
    if (this.position === this.buffer.length) {
      this.position = start;
      return null;
    }

    if (!hasDigit) {
      this.position = start;
      return null;
    }

    const numStr = this.buffer.slice(start, this.position);
    const num = Number(numStr);
    if (isNaN(num)) {
      this.position = start;
      return null;
    }

    return { type: 'number', value: num };
  }
}
