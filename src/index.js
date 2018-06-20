import parse from './parser';
import transform, { Transformer } from './transformer';

const generate = require('@babel/generator').default;

export default function (code) {
  const transformer = new Transformer(parse(code));
  const result = generate(transformer.transform());
  const str = `${transformer.polyfillText}\n${result.code}`;
  return str;
}

export { parse, transform, generate };
