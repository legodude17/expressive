import ExpressionTransformer from './transformer/expression';

export class Transformer extends ExpressionTransformer {
  constructor(ast) {
    super();
    this.ast = ast;
    this.registerHandler('*Literal');
    this.registerHandler('Identifier');
    this.registerHandler('Export*');
    this.registerHandler('Import*');
  }

  transform() {
    return this.transformNode(this.ast);
  }
}


export default function transform(ast) {
  const transformer = new Transformer(ast);
  return transformer.transform();
}
