import Parser from './parser';

import { types as tokTypes } from './tokenizer/types';
import './tokenizer/context';

export function parseExpression(input, options) {
  const parser = new Parser(options, input);
  if (parser.options.strictMode) {
    parser.state.strict = true;
  }
  return parser.getExpression();
}

export { tokTypes };

export default function parse(input, options) {
  const parser = new Parser(options, input);
  return parser.parse();
}
