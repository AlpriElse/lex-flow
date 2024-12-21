import { Lexer } from '../src/lexer.ts';
import { assertEquals, assert } from "jsr:@std/assert";
import { StringToken, NumberToken, ValueToken } from '../src/types.ts';

Deno.test('should return null when buffer is empty', () => {
  const lexer = new Lexer();
  const token = lexer.nextToken();
  assertEquals(token, null, `Expected null, got ${token}`);
});

Deno.test('should tokenize braces as begin-object and end-object', () => {
  const lexer = new Lexer();
  lexer.addChunk('{}');
  let token = lexer.nextToken();
  assertEquals(token?.type, 'begin-object', `Expected begin-object, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token?.type, 'end-object', `Expected end-object, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token, null, `Expected null, got ${token}`);
});

Deno.test('should tokenize brackets as begin-array and end-array', () => {
  const lexer = new Lexer();
  lexer.addChunk('[]');
  let token = lexer.nextToken();
  assertEquals(token?.type, 'begin-array', `Expected begin-array, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token?.type, 'end-array', `Expected end-array, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token, null, `Expected null, got ${token}`);
});

Deno.test('should tokenize colon and comma as name-separator and value-separator', () => {
  const lexer = new Lexer();
  lexer.addChunk(':,');
  let token = lexer.nextToken();
  assertEquals(token?.type, 'name-separator', `Expected name-separator, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token?.type, 'value-separator', `Expected value-separator, got ${token}`);
  token = lexer.nextToken();
  assertEquals(token, null, `Expected null, got ${token}`);
});

Deno.test('should tokenize string', () => {
  const lexer = new Lexer();
  lexer.addChunk('"hello"');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'string', `Expected string, got ${token}`);
  assertEquals((token as StringToken).value, 'hello', `Expected value "hello", got ${(token as StringToken).value}`);
});

Deno.test('should tokenize number', () => {
  const lexer = new Lexer();
  lexer.addChunk('123,');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'number', `Expected number, got ${token}`);
  assertEquals((token as NumberToken).value, 123, `Expected value 123, got ${(token as NumberToken).value}`);
});

Deno.test('should tokenize true literal', () => {
  const lexer = new Lexer();
  lexer.addChunk('true');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, true, `Expected value true, got ${(token as ValueToken).value}`);
});

Deno.test('should tokenize false literal', () => {
  const lexer = new Lexer();
  lexer.addChunk('false');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, false, `Expected value false, got ${(token as ValueToken).value}`);
});

Deno.test('should tokenize null literal', () => {
  const lexer = new Lexer();
  lexer.addChunk('null');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, null, `Expected value null, got ${(token as ValueToken).value}`);
});

Deno.test('should skip whitespace', () => {
  const lexer = new Lexer();
  lexer.addChunk('   true   ');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, true, `Expected value true, got ${(token as ValueToken).value}`);
});

Deno.test('should handle escaped characters in strings', () => {
  const lexer = new Lexer();
  lexer.addChunk('"hello\\nworld"');
  const token = lexer.nextToken();
  assertEquals(token?.type, 'string', `Expected string, got ${token}`);
  assertEquals((token as StringToken).value, 'hello\nworld', `Expected value "hello\\nworld", got ${(token as StringToken).value}`);
});

Deno.test('should return null for invalid number', () => {
  const lexer = new Lexer();
  lexer.addChunk('abc');
  const token = lexer.nextToken();
  assertEquals(token, null, `Expected null, got ${token}`);
});

Deno.test('should return null for partial literal and then tokenize true', () => {
  const lexer = new Lexer();
  lexer.addChunk('tru');
  let token = lexer.nextToken();
  assertEquals(token, null, `Expected null for partial literal, got ${token}`);
  
  lexer.addChunk('e');
  token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, true, `Expected value true, got ${(token as ValueToken).value}`);
});

Deno.test('should return null for partial literal and then tokenize false', () => {
  const lexer = new Lexer();
  lexer.addChunk('fals');
  let token = lexer.nextToken();
  assertEquals(token, null, `Expected null for partial literal, got ${token}`);
  
  lexer.addChunk('e');
  token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, false, `Expected value false, got ${(token as ValueToken).value}`);
});

Deno.test('should return null for partial literal and then tokenize null', () => {
  const lexer = new Lexer();
  lexer.addChunk('nul');
  let token = lexer.nextToken();
  assertEquals(token, null, `Expected null for partial literal, got ${token}`);
  
  lexer.addChunk('l');
  token = lexer.nextToken();
  assertEquals(token?.type, 'value', `Expected value, got ${token}`);
  assertEquals((token as ValueToken).value, null, `Expected value null, got ${(token as ValueToken).value}`);
});

Deno.test('should return null for partial string and then tokenize complete string', () => {
  const lexer = new Lexer();
  lexer.addChunk('"hello');
  let token = lexer.nextToken();
  assertEquals(token, null, `Expected null for partial string, got ${token}`);
  
  lexer.addChunk('"');
  token = lexer.nextToken();
  assertEquals(token?.type, 'string', `Expected string, got ${token}`);
  assertEquals((token as StringToken).value, 'hello', `Expected value "hello", got ${(token as StringToken).value}`);
});

Deno.test('should return null for partial number and then tokenize complete number', () => {
  const lexer = new Lexer();
  lexer.addChunk('12');
  let token = lexer.nextToken();
  assertEquals(token, null, `Expected null for partial number, got ${token}`);
  
  lexer.addChunk('3 ');
  token = lexer.nextToken();
  assertEquals(token?.type, 'number', `Expected number, got ${token}`);
  assertEquals((token as NumberToken).value, 123, `Expected value 123, got ${(token as NumberToken).value}`);
});