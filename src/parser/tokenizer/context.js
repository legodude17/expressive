// The algorithm used to determine whether a regexp can appear at a
// given point in the program is loosely based on sweet.js' approach.
// See https://github.com/mozilla/sweet.js/wiki/design

import { types as tt } from './types';
import { lineBreak } from '../util/whitespace';

export class TokContext {
  constructor(
    token,
    isExpr,
    preserveSpace,
    override, // Takes a Tokenizer as a this-parameter, and returns void.
  ) {
    this.token = token;
    this.isExpr = !!isExpr;
    this.preserveSpace = !!preserveSpace;
    this.override = override;
  }

  // token: string;
  // isExpr: boolean;
  // preserveSpace: boolean;
  // override: ?Function;
}

export const types = {
  braceStatement: new TokContext('{', false),
  braceExpression: new TokContext('{', true),
  templateQuasi: new TokContext('${', true),
  parenStatement: new TokContext('(', false),
  parenExpression: new TokContext('(', true),
  template: new TokContext('`', true, true, p => p.readTmplToken()),
  functionExpression: new TokContext('function', true)
};

// Token-specific context update code

tt.parenR.updateContext = tt.braceR.updateContext = function update() {
  if (this.state.context.length === 1) {
    this.state.exprAllowed = true;
    return;
  }

  const out = this.state.context.pop();
  if (
    out === types.braceStatement &&
    this.curContext() === types.functionExpression
  ) {
    this.state.context.pop();
    this.state.exprAllowed = false;
  } else if (out === types.templateQuasi) {
    this.state.exprAllowed = true;
  } else {
    this.state.exprAllowed = !out.isExpr;
  }
};

tt.name.updateContext = function update(prevType) {
  if (this.state.value === 'of' && this.curContext() === types.parenStatement) {
    this.state.exprAllowed = !prevType.beforeExpr;
    return;
  }

  this.state.exprAllowed = false;

  if (prevType === tt._let || prevType === tt._const || prevType === tt._var) {
    if (lineBreak.test(this.input.slice(this.state.end))) {
      this.state.exprAllowed = true;
    }
  }
  if (this.state.isIterator) {
    this.state.isIterator = false;
  }
};

tt.braceL.updateContext = function update(prevType) {
  this.state.context.push(this.braceIsBlock(prevType) ? types.braceStatement : types.braceExpression);
  this.state.exprAllowed = true;
};

tt.dollarBraceL.updateContext = function update() {
  this.state.context.push(types.templateQuasi);
  this.state.exprAllowed = true;
};

tt.parenL.updateContext = function update(prevType) {
  const statementParens =
    prevType === tt._if ||
    prevType === tt._for ||
    prevType === tt._with ||
    prevType === tt._while;
  this.state.context.push(statementParens ? types.parenStatement : types.parenExpression);
  this.state.exprAllowed = true;
};

tt.incDec.updateContext = function noop() {
  // tokExprAllowed stays unchanged
};

tt._function.updateContext = function update(prevType) {
  if (this.state.exprAllowed && !this.braceIsBlock(prevType)) {
    this.state.context.push(types.functionExpression);
  }

  this.state.exprAllowed = false;
};

tt.backQuote.updateContext = function update() {
  if (this.curContext() === types.template) {
    this.state.context.pop();
  } else {
    this.state.context.push(types.template);
  }
  this.state.exprAllowed = false;
};
