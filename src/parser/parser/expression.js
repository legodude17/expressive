// A recursive descent parser operates by defining functions for all
// syntactic elements, and recursively calling those, each function
// advancing the input stream and returning an AST node. Precedence
// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
// instead of `(!x)[1]` is handled by the fact that the parser
// function that parses unary prefix operators is called first, and
// in turn calls the function that parses `[]` subscripts — that
// way, it'll receive the node for `x[1]` already parsed, and wraps
// *that* in the unary operator node.
//
// Acorn uses an [operator precedence parser][opp] to handle binary
// operator precedence, because it is much more compact than using
// the technique outlined above, which uses different, nesting
// functions to specify precedence, for all of the ten binary
// precedence levels that JavaScript defines.
//
// [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

import { types as tt } from '../tokenizer/types';
import LValParser from './lval';

export default class ExpressionParser extends LValParser {
  // Check if property name clashes with already added.
  // Object/class getters and setters are not allowed to clash —
  // either with each other or with an init property — and in
  // strict mode, init properties are also not allowed to be repeated.

  checkPropClash(
    prop,
    propHash,
  ) {
    if (prop.computed || prop.kind) return;

    const { key } = prop;
    // It is either an Identifier or a String/NumericLiteral
    const name = key.type === 'Identifier' ? key.name : String(key.value);

    if (name === '__proto__') {
      if (propHash.proto) {
        this.raise(key.start, 'Redefinition of __proto__ property');
      }
      propHash.proto = true;
    }
  }

  // Convenience method to parse an Expression only
  getExpression() {
    this.nextToken();
    const expr = this.parseExpression();
    if (!this.match(tt.eof)) {
      this.unexpected();
    }
    expr.comments = this.state.comments;
    return expr;
  }

  // ### Expression parsing

  // These nest, from the most general expression type at the top to
  // 'atomic', nondivisible expression types at the bottom. Most of
  // the functions will simply let the function (s) below them parse,
  // and, *if* the syntactic construct they handle is present, wrap
  // the AST node that the inner parser gave them in another node.

  // Parse a full expression. The optional arguments are used to
  // forbid the `in` operator (in for loops initialization expressions)
  // and provide reference for storing '=' operator inside shorthand
  // property assignment in contexts where both object expression
  // and object pattern might appear (so it's possible to raise
  // delayed syntax error at correct position).

  parseExpression(isStatement = false) {
    const starttype = this.state.type;
    const node = this.startNode();
    node.isStatement = isStatement;

    // Most types of expressions are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {
    case tt._do:
      return this.parseDo(node);
    case tt._for:
      return this.parseAnyFor(node);
    case tt._function:
      return this.parseFunctionExpression();

    case tt._class:
      return this.parseClass(node, false);

    case tt._if:
      return this.parseIf(node);
    case tt._switch:
      return this.parseSwitch(node);
    case tt._try:
      return this.parseTry(node);
    case tt._cond:
      return this.parseCond(node);

    case tt._async:
      this.next();
      if (this.eat(tt.parenL)) {
        const params = this.parseBindingList(tt.parenR, false);
        if (!(this.match(tt.arrow) || this.match(tt.arrowThin))) this.unexpected();
        node.kind = this.eat(tt.arrow) ? 'Thick' : 'Thin';
        return this.parseArrowExpression(node, params, true);
      }
      if (this.match(tt.name)) {
        const id = this.parseIdentifier();
        if (!(this.match(tt.arrow) || this.match(tt.arrowThin))) this.unexpected();
        node.kind = this.eat(tt.arrow) ? 'Thick' : 'Thin';
        return this.parseArrowExpression(node, [id], true);
      }
      return this.parseFunction(node, false, true, false);

    case tt._let:
    case tt._const:
    case tt._var:
      return this.parseVar(node, false, starttype);

    case tt._while:
      return this.parseWhile(node);
    default:
      return this.parseExpressionNoKeyword();
    }
  }

  parseExpressionNoKeyword(refShorthandDefaultPos) {
    const startPos = this.state.start;
    const { startLoc } = this.state;
    const expr = this.parseMaybeAssign(refShorthandDefaultPos);
    if (this.match(tt.comma)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this.eat(tt.comma)) {
        node.expressions.push(this.parseMaybeAssign(refShorthandDefaultPos));
      }
      return this.finishNode(node, 'SequenceExpression');
    }
    return expr;
  }

  // TODO: Parse if else if else as a thing
  parseIf(node) {
    this.next();
    node.test = this.parseParenExpression();
    node.consequent = this.parseBlock(true);
    node.alternate = this.eat(tt._else) ? this.parseBlock(true) : null;
    return this.finishNode(node, 'If');
  }

  parseReturn(node) {
    if (!this.state.inFunction && !this.options.allowReturnOutsideFunction) {
      this.raise(this.state.start, "'return' outside of function");
    }
    this.next();
    if (this.match(tt.semi)) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }

    return this.finishNode(node, 'Return');
  }

  parseAnyFor(node) {
    this.next();

    let forAwait = false;
    if (this.state.inAsync && this.isContextual('await')) {
      forAwait = true;
      this.next();
    }
    this.expect(tt.parenL);

    if (this.match(tt.semi)) {
      if (forAwait) {
        this.unexpected();
      }
      return this.parseFor(node, null);
    }

    if (this.match(tt._var) || this.match(tt._let) || this.match(tt._const)) {
      const init = this.startNode();
      const varKind = this.state.type;
      this.next();
      this.parseVar(init, true, varKind);
      this.finishNode(init, 'VariableDeclaration');
      this.toAssignable(init, true, 'for');
      this.checkLVal(init, true, false, 'for');
      if (this.isContextual('of') && init.declarations.length === 1) {
        return this.parseForOf(node, init, forAwait);
      }
      if (forAwait) {
        this.unexpected();
      }
      return this.parseFor(node, init);
    }

    return this.parseFor(node);
  }

  parseFor(node, init) {
    node.init = init === undefined ? this.parseExpressionNoKeyword() : init;
    this.expect(tt.semi);
    node.test = this.match(tt.semi) ? null : this.parseExpressionNoKeyword();
    this.expect(tt.semi);
    node.update = this.match(tt.parenR) ? null : this.parseExpressionNoKeyword();
    this.expect(tt.parenR);
    node.body = this.parseBlock(true);
    this.state.labels.pop();
    return this.finishNode(node, 'For');
  }

  parseForOf(node, init, forAwait) {
    this.expectContextual('of');
    node.await = !!forAwait;
    node.left = init;
    node.right = this.parseExpression();
    this.expect(tt.parenR);
    node.body = this.parseBlock(true);
    this.state.labels.pop();
    return this.finishNode(node, 'ForOf');
  }

  parseWhile(node) {
    this.next();
    node.test = this.parseParenExpression();
    node.body = this.parseBlock(true);
    return this.finishNode(node, 'While');
  }

  parseSwitch(node) {
    this.next();
    node.discriminant = this.parseParenExpression();
    node.cases = [];
    this.expect(tt.braceL);

    for (let sawDefault; !this.eat(tt.braceR);) {
      if (this.match(tt._case) || this.match(tt._default)) {
        const isCase = this.match(tt._case);
        const cur = this.startNode();
        this.next();
        if (isCase) {
          cur.test = this.parseParenExpression();
        } else {
          if (sawDefault) {
            this.raise(this.state.lastTokStart, 'Multiple default clauses');
          }
          sawDefault = true;
          cur.test = null;
        }
        cur.consequent = this.parseBlock(true);
        node.cases.push(this.finishNode(cur, 'SwitchCase'));
      } else {
        this.unexpected();
      }
    }
    return this.finishNode(node, 'Switch');
  }

  parseTry(node) {
    this.next();

    node.block = this.parseBlock(true);
    node.handler = null;

    if (this.match(tt._catch)) {
      const clause = this.startNode();
      this.next();
      if (this.match(tt.parenL)) {
        this.expect(tt.parenL);
        clause.param = this.parseBindingAtom();
        this.checkLVal(clause.param, true, Object.create(null), 'catch clause');
        this.expect(tt.parenR);
      } else {
        clause.param = null;
      }
      clause.body = this.parseBlock();
      node.handler = this.finishNode(clause, 'CatchClause');
    }

    node.finalizer = this.eat(tt._finally) ? this.parseBlock(true) : null;

    if (!node.handler && !node.finalizer) {
      this.raise(node.start, 'Missing catch or finally clause');
    }

    return this.finishNode(node, 'TryStatement');
  }

  // Parse a list of variable declarations.

  parseVar(node, isFor, kind) {
    node.declarations = [];
    node.kind = kind.keyword;
    this.next();
    if (this.match(tt.comma) || this.match(tt.semi)) this.unexpected(`${node.kind} requires declarations`);
    do {
      const decl = this.startNode();
      this.parseVarHead(decl);
      if (this.eat(tt.eq)) {
        decl.init = this.parseExpression();
      } else {
        if (node.kind === tt._const) {
          this.unexpected();
        } else if (decl.id.type !== 'Identifier' && !this.isContextual('of')) {
          this.raise(
            this.state.lastTokEnd,
            'Complex binding patterns require an initialization value',
          );
        }
        decl.init = null;
      }
      node.declarations.push(this.finishNode(decl, 'VariableDeclarator'));
    } while (this.eat(tt.comma));
    return this.finishNode(node, 'VariableDeclaration');
  }

  parseVarHead(decl) {
    decl.id = this.parseBindingAtom();
    this.checkLVal(decl.id, true, undefined, 'variable declaration');
  }

  parseCond() {
    const node = this.startNode();
    this.expect(tt._cond);
    node.descriminent = this.parseParenExpression();
    this.expect(tt.braceL);
    node.items = this.parseCondBlock();
    return this.finishNode(node, 'Cond');
  }

  parseCondBlock() {
    const items = [];
    while (!this.eat(tt.braceR)) {
      const item = this.startNode();
      item.matcher = this.parseCondMatcher();
      this.expect(tt.arrow);
      item.consequent = this.parseBlock(true);
      this.semicolon();
      items.push(this.finishNode(item, 'CondItem'));
    }
    return items;
  }

  parseCondMatcher() {
    const matcher = this.startNode();
    switch (this.state.type) {
    case tt.name:
      matcher.id = this.parseIdentifier();
      if (this.eat(tt.hash)) {
        matcher.collection = this.parseCondMatcher();
        return this.finishNode(matcher, 'CollectionMatcher');
      }
      return this.finishNode(matcher, 'VariableMatcher');
    case tt.braceL:
      return this.parseCondObjectMatcher(matcher);
    case tt.bracketL:
      return this.parseCondArrayMatcher(matcher);
    default:
      matcher.expression = this.parseExpression();
      return this.finishNode(matcher, 'ExpressionMatcher');
    }
  }

  parseCondObjectMatcher(matcher) {
    this.expect(tt.braceL);
    matcher.props = [];
    while (!this.eat(tt.braceR)) {
      const prop = this.startNode();
      this.parsePropertyName(prop);
      if (this.eat(tt.colon)) {
        prop.value = this.parseCondMatcher();
      }
      matcher.props.push(this.finishNode(prop, 'ObjectMatcherProperty'));
      if (!(this.eat(tt.comma) || this.match(tt.braceR))) this.unexpected(null, tt.comma);
    }
    return this.finishNode(matcher, 'ObjectMatcher');
  }

  parseCondArrayMatcher(matcher) {
    this.expect(tt.bracketL);
    matcher.parts = [];
    while (!this.eat(tt.bracketR)) {
      matcher.parts.push(this.parseCondMatcher());
      if (!(this.eat(tt.comma) || this.match(tt.bracketR))) this.unexpected(null, tt.comma);
    }
    return this.finishNode(matcher, 'ArrayMatcher');
  }
  // Parse an assignment expression. This includes applications of
  // operators like `+=`.

  parseMaybeAssign(
    refShorthandDefaultPos,
    afterLeftParse,
    refNeedsArrowPos
  ) {
    const startPos = this.state.start;
    const { startLoc } = this.state;
    if (this.match(tt._yield) && this.state.inGenerator) {
      let left = this.parseYield();
      if (afterLeftParse) {
        left = afterLeftParse.call(this, left, startPos, startLoc);
      }
      return left;
    }

    let failOnShorthandAssign;
    if (refShorthandDefaultPos) {
      failOnShorthandAssign = false;
    } else {
      refShorthandDefaultPos = { start: 0 };
      failOnShorthandAssign = true;
    }

    if (this.match(tt.parenL) || this.match(tt.name)) {
      this.state.potentialArrowAt = this.state.start;
    }

    let left = this.parseMaybeConditional(
      refShorthandDefaultPos,
      refNeedsArrowPos,
    );
    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }
    if (this.state.type.isAssign) {
      const node = this.startNodeAt(startPos, startLoc);
      const operator = this.state.value;
      node.operator = operator;

      node.left = this.match(tt.eq)
        ? this.toAssignable(left, undefined, 'assignment expression')
        : left;
      refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly

      this.checkLVal(left, undefined, undefined, 'assignment expression');

      if (left.extra && left.extra.parenthesized) {
        let errorMsg;
        if (left.type === 'ObjectPattern') {
          errorMsg = '`({a}) = 0` use `({a} = 0)`';
        } else if (left.type === 'ArrayPattern') {
          errorMsg = '`([a]) = 0` use `([a] = 0)`';
        }
        if (errorMsg) {
          this.raise(
            left.start,
            `You're trying to assign to a parenthesized expression, eg. instead of ${errorMsg}`,
          );
        }
      }

      this.next();
      node.right = this.parseMaybeAssign();
      return this.finishNode(node, 'AssignmentExpression');
    } else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }

    return left;
  }

  // Parse a ternary conditional (`?:`) operator.

  parseMaybeConditional(
    refShorthandDefaultPos,
    refNeedsArrowPos
  ) {
    const startPos = this.state.start;
    const { startLoc } = this.state;
    const { potentialArrowAt } = this.state;
    const expr = this.parseExprOps(refShorthandDefaultPos);

    if (
      expr.type === 'ArrowFunction' &&
      expr.start === potentialArrowAt
    ) {
      return expr;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;

    return this.parseConditional(
      expr,
      startPos,
      startLoc,
      refNeedsArrowPos,
    );
  }

  parseConditional(
    expr,
    startPos,
    startLoc,
    // FIXME: Disabling this for now since can't seem to get it to play nicely
    // eslint-disable-next-line no-unused-vars
    refNeedsArrowPos,
  ) {
    if (this.eat(tt.question)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssign();
      this.expect(tt.colon);
      node.alternate = this.parseMaybeAssign();
      return this.finishNode(node, 'ConditionalExpression');
    }
    return expr;
  }

  // Start the precedence parser.

  parseExprOps(refShorthandDefaultPos) {
    const startPos = this.state.start;
    const { startLoc, potentialArrowAt } = this.state;
    const expr = this.parseMaybeUnary(refShorthandDefaultPos);

    if (
      expr.type === 'ArrowFunction' &&
      expr.start === potentialArrowAt
    ) {
      return expr;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1);
  }

  // Parse binary operators with the operator precedence parsing
  // algorithm. `left` is the left-hand side of the operator.
  // `minPrec` provides context that allows the function to stop and
  // defer further parser to one of its callers when it encounters an
  // operator that has a lower precedence than the set it is parsing.

  parseExprOp(
    left,
    leftStartPos,
    leftStartLoc,
    minPrec
  ) {
    const prec = this.state.type.binop;
    if (this.match(tt.pipeline) && this.state.noPipe) {
      return left;
    }
    if (prec != null && !this.match(tt._in)) {
      if (prec > minPrec) {
        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        const operator = this.state.value;
        node.left = left;
        node.operator = operator;

        if (
          operator === '**' &&
          left.type === 'UnaryExpression' &&
          left.extra &&
          !left.extra.parenthesizedArgument &&
          !left.extra.parenthesized
        ) {
          this.raise(
            left.argument.start,
            'Illegal expression. Wrap left hand side or entire exponentiation in parentheses.',
          );
        }

        const op = this.state.type;

        this.next();

        const startPos = this.state.start;
        const { startLoc } = this.state;

        if (op === tt.pipeline) {
          // Support syntax such as 10 |> x => x + 1
          this.state.potentialArrowAt = startPos;
        }

        node.right = this.parseExprOp(
          this.parseMaybeUnary(),
          startPos,
          startLoc,
          op.rightAssociative ? prec - 1 : prec
        );

        this.finishNode(
          node,
          op === tt.logicalOR ||
          op === tt.logicalAND ||
          op === tt.nullishCoalescing
            ? 'LogicalExpression'
            : 'BinaryExpression',
        );
        return this.parseExprOp(
          node,
          leftStartPos,
          leftStartLoc,
          minPrec
        );
      }
    }
    return left;
  }

  // Parse unary operators, both prefix and postfix.

  parseMaybeUnary(refShorthandDefaultPos) {
    if (this.state.type.prefix) {
      const node = this.startNode();
      const update = this.match(tt.incDec);
      node.operator = this.state.value;
      node.prefix = true;
      this.next();

      const argType = this.state.type;
      node.argument = this.parseMaybeUnary();

      this.addExtra(
        node,
        'parenthesizedArgument',
        argType === tt.parenL &&
          (!node.argument.extra || !node.argument.extra.parenthesized),
      );

      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        this.unexpected(refShorthandDefaultPos.start);
      }

      if (update) {
        this.checkLVal(node.argument, undefined, undefined, 'prefix operation');
      } else if (this.state.strict && node.operator === 'delete') {
        const arg = node.argument;

        if (arg.type === 'Identifier') {
          this.raise(node.start, 'Deleting local variable in strict mode');
        } else if (
          arg.type === 'MemberExpression' &&
          arg.property.type === 'PrivateName'
        ) {
          this.raise(node.start, 'Deleting a private field is not allowed');
        }
      }

      return this.finishNode(
        node,
        update ? 'UpdateExpression' : 'UnaryExpression',
      );
    }

    const startPos = this.state.start;
    const { startLoc } = this.state;
    let expr = this.parseExprSubscripts(refShorthandDefaultPos);
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
    while (this.state.type.postfix && !this.match(tt.semi)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.prefix = false;
      node.argument = expr;
      this.checkLVal(expr, undefined, undefined, 'postfix operation');
      this.next();
      expr = this.finishNode(node, 'UpdateExpression');
    }
    return expr;
  }

  // Parse call, dot, and `[]`-subscript expressions.

  parseExprSubscripts(refShorthandDefaultPos) {
    const startPos = this.state.start;
    const { startLoc, potentialArrowAt } = this.state;
    const expr = this.parseExprAtom(refShorthandDefaultPos);

    if (
      expr.type === 'ArrowFunction' &&
      expr.start === potentialArrowAt
    ) {
      return expr;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  }

  parseSubscripts(
    base,
    startPos,
    startLoc,
    noCalls,
  ) {
    const state = {
      optionalChainMember: false,
      stop: false
    };
    do {
      base = this.parseSubscript(base, startPos, startLoc, noCalls, state);
    } while (!state.stop);
    return base;
  }

  /**
   * @param state Set 'state.stop = true' to indicate that we should stop parsing subscripts.
   *   state.optionalChainMember to indicate that the member is currently in OptionalChain
   */
  parseSubscript(
    base,
    startPos,
    startLoc,
    noCalls,
    state
  ) {
    if (!noCalls && this.eat(tt.doubleColon)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.callee = this.parseNoCallExpr();
      state.stop = true;
      return this.parseSubscripts(
        this.finishNode(node, 'BindExpression'),
        startPos,
        startLoc,
        noCalls,
      );
    } else if (this.match(tt.questionDot)) {
      state.optionalChainMember = true;
      if (noCalls && this.lookahead().type === tt.parenL) {
        state.stop = true;
        return base;
      }
      this.next();

      const node = this.startNodeAt(startPos, startLoc);

      if (this.eat(tt.bracketL)) {
        node.object = base;
        node.property = this.parseMember();
        node.computed = true;
        node.optional = true;
        this.expect(tt.bracketR);
        return this.finishNode(node, 'OptionalMemberExpression');
      } else if (this.eat(tt.parenL)) {
        node.callee = base;
        node.arguments = this.parseCallExpressionArguments(tt.parenR);
        node.optional = true;

        return this.finishNode(node, 'OptionalCallExpression');
      }
      node.object = base;
      node.property = this.parseIdentifier();
      node.computed = false;
      node.optional = true;
      return this.finishNode(node, 'OptionalMemberExpression');
    } else if (this.eat(tt.dot)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseIdentifier();
      node.computed = false;
      if (state.optionalChainMember) {
        node.optional = false;
        return this.finishNode(node, 'OptionalMemberExpression');
      }
      return this.finishNode(node, 'MemberExpression');
    } else if (this.eat(tt.bracketL)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseMember();
      node.computed = true;
      this.expect(tt.bracketR);
      if (state.optionalChainMember) {
        node.optional = false;
        return this.finishNode(node, 'OptionalMemberExpression');
      }
      return this.finishNode(node, 'MemberExpression');
    } else if (!noCalls && this.match(tt.parenL)) {
      this.next();

      const node = this.startNodeAt(startPos, startLoc);
      node.callee = base;

      // TODO: Clean up/merge this into `this.state` or a class like acorn's
      // `DestructuringErrors` alongside refShorthandDefaultPos and
      // refNeedsArrowPos.
      const refTrailingCommaPos = { start: -1 };

      node.arguments = this.parseCallExpressionArguments(
        tt.parenR,
        refTrailingCommaPos
      );
      if (this.match(tt.braceL) || this.match(tt._do)) {
        state.stop = true;
        const blockParam = this.startNode();
        blockParam.body = [];
        blockParam.isDo = this.eat(tt._do);
        if (blockParam.isDo && this.match(tt.parenL)) {
          this.parseFunctionParams(blockParam, false);
        } else {
          blockParam.params = [];
        }
        this.parseFunctionBody(blockParam, false, true);
        node.blockParam = this.finishNode(blockParam, 'BlockParam');
      }

      if (!state.optionalChainMember) {
        this.finishCallExpression(node);
      } else {
        this.finishOptionalCallExpression(node);
      }

      return node;
    } else if (this.match(tt.backQuote)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.tag = base;
      node.quasi = this.parseTemplate(true);
      if (state.optionalChainMember) {
        this.raise(
          startPos,
          'Tagged Template Literals are not allowed in optionalChain',
        );
      }
      return this.finishNode(node, 'TaggedTemplateExpression');
    }
    state.stop = true;
    return base;
  }

  finishCallExpression(node) {
    if (node.callee.type === 'Import') {
      if (node.arguments.length !== 1) {
        this.raise(node.start, 'import() requires exactly one argument');
      }

      const importArg = node.arguments[0];
      if (importArg && importArg.type === 'SpreadElement') {
        this.raise(importArg.start, '... is not allowed in import()');
      }
    }
    return this.finishNode(node, 'CallExpression');
  }

  finishOptionalCallExpression(node) {
    if (node.callee.type === 'Import') {
      if (node.arguments.length !== 1) {
        this.raise(node.start, 'import() requires exactly one argument');
      }

      const importArg = node.arguments[0];
      if (importArg && importArg.type === 'SpreadElement') {
        this.raise(importArg.start, '... is not allowed in import()');
      }
    }
    return this.finishNode(node, 'OptionalCallExpression');
  }

  parseCallExpressionArguments(
    close,
    refTrailingCommaPos
  ) {
    const elts = [];
    let innerParenStart;
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(close)) break;
      }

      // we need to make sure that if this is an async arrow functions,
      // that we don't allow inner parens inside the params
      if (this.match(tt.parenL) && !innerParenStart) {
        innerParenStart = this.state.start;
      }

      elts.push(this.parseExprListItem(
        false,
        { start: 0 },
        { start: 0 },
        refTrailingCommaPos
      ));
    }

    return elts;
  }
  // Parse a no-call expression (like argument of `new` or `::` operators).

  parseNoCallExpr() {
    const startPos = this.state.start;
    const { startLoc } = this.state;
    return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  }

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.

  parseExprAtom(refShorthandDefaultPos) {
    const canBeArrow = this.state.potentialArrowAt === this.state.start;
    switch (this.state.type) {
    case tt._super: {
      if (
        !this.state.inMethod &&
          !this.state.inClassProperty &&
          !this.options.allowSuperOutsideMethod
      ) {
        this.raise(
          this.state.start,
          'super is only allowed in object methods and classes',
        );
      }

      const node = this.startNode();
      this.next();
      if (
        !this.match(tt.parenL) &&
          !this.match(tt.bracketL) &&
          !this.match(tt.dot)
      ) {
        this.unexpected();
      }
      if (
        this.match(tt.parenL) &&
          this.state.inMethod !== 'constructor' &&
          !this.options.allowSuperOutsideMethod
      ) {
        this.raise(
          node.start,
          'super() is only valid inside a class constructor. ' +
              "Make sure the method name is spelled exactly as 'constructor'.",
        );
      }
      return this.finishNode(node, 'Super');
    }

    case tt._import: {
      if (this.lookahead().type === tt.dot) {
        return this.parseImportMetaProperty();
      }


      const node = this.startNode();
      this.next();
      node.argument = this.parseParenExpression();
      return this.finishNode(node, 'Import');
    }

    case tt._this: {
      const node = this.startNode();
      this.next();
      return this.finishNode(node, 'ThisExpression');
    }

    case tt.name: {
      const node = this.startNode();
      const id = this.parseIdentifier();

      if (this.match(tt.hash)) {
        node.constructor = id;
        this.next();
        if (this.match(tt.braceL)) {
          node.collection = this.parseObj(false, refShorthandDefaultPos);
        } else if (this.match(tt.bracketL)) {
          node.collection = this.parseArrayExpression(refShorthandDefaultPos);
        } else if (this.match(tt.parenL)) {
          node.collection = this.parseParenAndDistinguishExpression(
            true,
            refShorthandDefaultPos,
          );
        } else if (this.match(tt.name)) {
          node.collection = this.parseIdentifier();
        } else {
          node.collection = this.parseExprAtom(refShorthandDefaultPos);
        }
        return this.finishNode(node, 'CollectionLiteral');
      } else if (canBeArrow && !this.match(tt.semi) && (this.eat(tt.arrow) || this.eat(tt.arrowThin))) {
        const oldYield = this.state.yieldInPossibleArrowParameters;
        node.kind = this.matchPrev(tt.arrow) ? 'Thick' : 'Thin';
        this.state.yieldInPossibleArrowParameters = null;
        this.parseArrowExpression(node, [id]);
        this.state.yieldInPossibleArrowParameters = oldYield;
        return node;
      }

      return id;
    }

    case tt.regexp: {
      const { value } = this.state;
      const node = this.parseLiteral(value.value, 'RegExpLiteral');
      node.pattern = value.pattern;
      node.flags = value.flags;
      return node;
    }

    case tt.num:
      return this.parseLiteral(this.state.value, 'NumericLiteral');

    case tt.bigint:
      return this.parseLiteral(this.state.value, 'BigIntLiteral');

    case tt.string:
      return this.parseLiteral(this.state.value, 'StringLiteral');

    case tt._null: {
      const node = this.startNode();
      this.next();
      return this.finishNode(node, 'NullLiteral');
    }

    case tt._true:
    case tt._false:
      return this.parseBooleanLiteral();

    case tt.parenL:
      return this.parseParenAndDistinguishExpression(canBeArrow);

    case tt.bracketL:
      return this.parseArrayExpression(refShorthandDefaultPos);

    case tt.braceL:
      return this.parseObj(false, refShorthandDefaultPos);

    case tt._function:
      return this.parseFunctionExpression();

    case tt._class:
      return this.parseClass(this.startNode(), false);

    case tt._new:
      return this.parseNew();

    case tt.backQuote:
      return this.parseTemplate(false);

    case tt.doubleColon: {
      const node = this.startNode();
      this.next();
      node.object = null;
      const callee = (node.callee = this.parseNoCallExpr());
      if (callee.type === 'MemberExpression') {
        return this.finishNode(node, 'BindExpression');
      }
      throw this.raise(
        callee.start,
        'Binding should be performed on object property.',
      );
    }

    case tt._return:
    case tt._throw: {
      const node = this.startNode();
      const type = this.match(tt._return) ? 'Return' : 'Throw';
      if (this.match(tt.semi)) this.unexpected(null, `${type} requires argument`);
      this.next();
      node.argument = this.parseExpression();
      return this.finishNode(node, type);
    }

    case tt._await:
      return this.parseAwait();

    case tt._export:
      return this.unexpected(null, 'Cannot use export without being in the top level');

    case tt._break:
    case tt._debugger:
    case tt._continue: {
      const node = this.startNode();
      let type = 'Break';
      if (this.match(tt._debugger)) type = 'Debugger';
      if (this.match(tt._continue)) type = 'Continue';
      this.next();
      return this.finishNode(node, type);
    }

    default:
      throw this.unexpected();
    }
  }

  parseDo() {
    const node = this.startNode();
    this.next();
    node.body = this.parseBlock(true);
    this.expect(tt._while);
    node.test = this.parseParenExpression();
    this.eat(tt.semi);
    return this.finishNode(node, 'DoWhile');
  }

  parseBooleanLiteral() {
    const node = this.startNode();
    node.value = this.match(tt._true);
    this.next();
    return this.finishNode(node, 'BooleanLiteral');
  }

  parseFunctionExpression() {
    const node = this.startNode();
    const meta = this.startNode();
    meta.name = 'function';
    this.next();
    if (this.state.inGenerator && this.eat(tt.dot)) {
      return this.parseMetaProperty(node, this.finishNode(meta, 'Identifier'), 'sent');
    }
    return this.parseFunction(node, true);
  }

  parseMetaProperty(
    node,
    meta,
    propertyName
  ) {
    node.meta = meta;

    if (meta.name === 'function' && propertyName === 'sent') {
      if (this.isContextual(propertyName)) {
        // this.expectPlugin('functionSent'); // TODO: Do we want this?
      } /* else if (!this.hasPlugin('functionSent')) {
        // The code wasn't `function.sent` but just `function.`, so a simple error is less confusing.
        this.unexpected();
      } */
    }

    const { containsEsc } = this.state;

    node.property = this.parseIdentifier();

    if (node.property.name !== propertyName || containsEsc) {
      this.raise(
        node.property.start,
        `The only valid meta property for ${meta.name} is ${
          meta.name
        }.${propertyName}`,
      );
    }

    return this.finishNode(node, 'MetaProperty');
  }

  parseImportMetaProperty() {
    const node = this.startNode();
    const id = this.parseIdentifier();
    this.expect(tt.dot);
    return this.parseMetaProperty(node, id, 'meta');
  }

  parseLiteral(
    value,
    type,
    startPos,
    startLoc
  ) {
    startPos = startPos || this.state.start;
    startLoc = startLoc || this.state.startLoc;

    const node = this.startNodeAt(startPos, startLoc);
    this.addExtra(node, 'rawValue', value);
    this.addExtra(node, 'raw', this.input.slice(startPos, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node, type);
  }

  parseParenExpression() {
    this.expect(tt.parenL);
    const val = this.parseExpression();
    this.expect(tt.parenR);
    return val;
  }

  parseParenAndDistinguishExpression(canBeArrow) {
    const startPos = this.state.start;
    const { startLoc } = this.state;

    let val;
    this.expect(tt.parenL);

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYield = this.state.yieldInPossibleArrowParameters;
    this.state.maybeInArrowParameters = true;
    this.state.yieldInPossibleArrowParameters = null;

    const innerStartPos = this.state.start;
    const innerStartLoc = this.state.startLoc;
    const exprList = [];
    const refShorthandDefaultPos = { start: 0 };
    const refNeedsArrowPos = { start: 0 };
    let first = true;
    let spreadStart;
    let optionalCommaStart;

    while (!this.match(tt.parenR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma, refNeedsArrowPos.start || null);
        if (this.match(tt.parenR)) {
          optionalCommaStart = this.state.start;
          break;
        }
      }

      if (this.match(tt.ellipsis)) {
        const spreadNodeStartPos = this.state.start;
        const spreadNodeStartLoc = this.state.startLoc;
        spreadStart = this.state.start;
        exprList.push(this.parseParenItem(
          this.parseRest(),
          spreadNodeStartPos,
          spreadNodeStartLoc,
        ));

        if (this.match(tt.comma) && this.lookahead().type === tt.parenR) {
          this.raise(
            this.state.start,
            'A trailing comma is not permitted after the rest element',
          );
        }

        break;
      } else {
        exprList.push(this.parseMaybeAssign(
          refShorthandDefaultPos,
          null,
          refNeedsArrowPos,
        ));
      }
    }

    const innerEndPos = this.state.start;
    const innerEndLoc = this.state.startLoc;
    this.expect(tt.parenR);

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

    const arrowNode = this.parseArrow(this.startNodeAt(startPos, startLoc));
    if (
      canBeArrow &&
      this.shouldParseArrow() &&
      arrowNode
    ) {
      for (const param of exprList) {
        if (param.extra && param.extra.parenthesized) {
          this.unexpected(param.extra.parenStart);
        }
      }

      this.parseArrowExpression(arrowNode, exprList);
      this.state.yieldInPossibleArrowParameters = oldYield;
      return arrowNode;
    }

    this.state.yieldInPossibleArrowParameters = oldYield;

    if (!exprList.length) {
      this.unexpected(this.state.lastTokStart);
    }
    if (optionalCommaStart) this.unexpected(optionalCommaStart);
    if (spreadStart) this.unexpected(spreadStart);
    if (refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }
    if (refNeedsArrowPos.start) this.unexpected(refNeedsArrowPos.start);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, 'SequenceExpression', innerEndPos, innerEndLoc);
    } else {
      [val] = exprList;
    }

    this.addExtra(val, 'parenthesized', true);
    this.addExtra(val, 'parenStart', startPos);

    return val;
  }

  shouldParseArrow() {
    return !this.match(tt.semi);
  }

  parseArrow(node) {
    if (this.eat(tt.arrow) || this.eat(tt.arrowThin)) {
      node.kind = this.matchPrev(tt.arrow) ? 'Thick' : 'Thin';
      return node;
    }
    return false;
  }

  /* eslint-disable class-methods-use-this */
  parseParenItem(
    node,
    startPos,
    // eslint-disable-next-line no-unused-vars
    startLoc,
  ) {
    return node;
  }
  /* eslint-enable class-methods-use-this */

  // New's precedence is slightly tricky. It must allow its argument to
  // be a `[]` or dot subscript expression, but not a call — at least,
  // not without wrapping it in parentheses. Thus, it uses the noCalls
  // argument to parseSubscripts to prevent it from consuming the
  // argument list.

  parseNew() {
    const node = this.startNode();
    const meta = this.parseIdentifier();

    if (this.eat(tt.dot)) {
      const metaProp = this.parseMetaProperty(node, meta, 'target');

      if (!this.state.inFunction && !this.state.inClassProperty) {
        const error = 'new.target can only be used in functions';

        this.raise(metaProp.start, error);
      }

      return metaProp;
    }

    node.callee = this.parseNoCallExpr();
    if (
      node.callee.type === 'OptionalMemberExpression' ||
      node.callee.type === 'OptionalCallExpression'
    ) {
      this.raise(
        this.state.lastTokEnd,
        'constructors in/after an Optional Chain are not allowed',
      );
    }
    if (this.eat(tt.questionDot)) {
      this.raise(
        this.state.start,
        'constructors in/after an Optional Chain are not allowed',
      );
    }
    this.parseNewArguments(node);
    return this.finishNode(node, 'NewExpression');
  }

  parseNewArguments(node) {
    if (this.eat(tt.parenL)) {
      const args = this.parseExprList(tt.parenR);
      // $FlowFixMe (parseExprList should be all non-null in this case)
      node.arguments = args;
    } else {
      node.arguments = [];
    }
  }

  // Parse template expression.

  parseTemplateElement(isTagged) {
    const elem = this.startNode();
    if (this.state.value === null) {
      if (!isTagged) {
        // TODO: fix this
        this.raise(
          this.state.invalidTemplateEscapePosition || 0,
          'Invalid escape sequence in template',
        );
      } else {
        this.state.invalidTemplateEscapePosition = null;
      }
    }
    elem.value = {
      raw: this.input
        .slice(this.state.start, this.state.end)
        .replace(/\r\n?/g, '\n'),
      cooked: this.state.value
    };
    this.next();
    elem.tail = this.match(tt.backQuote);
    return this.finishNode(elem, 'TemplateElement');
  }

  parseTemplate(isTagged) {
    const node = this.startNode();
    this.next();
    node.expressions = [];
    let curElt = this.parseTemplateElement(isTagged);
    node.quasis = [curElt];
    while (!curElt.tail) {
      this.expect(tt.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(tt.braceR);
      node.quasis.push((curElt = this.parseTemplateElement(isTagged)));
    }
    this.next();
    return this.finishNode(node, 'TemplateLiteral');
  }

  // Parse an object literal or binding pattern.

  parseObj(
    isPattern,
    refShorthandDefaultPos,
  ) {
    const decorators = [];
    const propHash = Object.create(null);
    let first = true;
    const node = this.startNode();

    node.properties = [];
    this.next();

    let firstRestLocation = null;

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      let prop = this.startNode();
      let isGenerator = false;
      let isAsync = false;
      let startPos;
      let startLoc;

      if (this.match(tt.ellipsis)) {
        prop = this.parseSpread(isPattern ? { start: 0 } : undefined);
        if (isPattern) {
          this.toAssignable(prop, true, 'object pattern');
        }
        node.properties.push(prop);
        if (isPattern) {
          const position = this.state.start;
          if (firstRestLocation !== null) {
            this.unexpected(
              firstRestLocation,
              'Cannot have multiple rest elements when destructuring',
            );
          } else if (this.eat(tt.braceR)) {
            break;
          } else if (
            this.match(tt.comma) &&
            this.lookahead().type === tt.braceR
          ) {
            this.unexpected(
              position,
              'A trailing comma is not permitted after the rest element',
            );
          } else {
            firstRestLocation = position;
            continue; // eslint-disable-line no-continue
          }
        } else {
          continue; // eslint-disable-line no-continue
        }
      }

      prop.method = false;

      if (isPattern || refShorthandDefaultPos) {
        startPos = this.state.start;
        ({ startLoc } = this.state);
      }

      if (!isPattern) {
        isGenerator = this.eat(tt.star);
      }

      const { containsEsc } = this.state;

      if (!isPattern && this.match(tt._async)) {
        if (isGenerator) this.unexpected();

        const asyncId = this.parseIdentifier();
        if (
          this.match(tt.colon) ||
          this.match(tt.parenL) ||
          this.match(tt.braceR) ||
          this.match(tt.eq) ||
          this.match(tt.comma)
        ) {
          prop.key = asyncId;
          prop.computed = false;
        } else {
          isAsync = true;
          if (this.match(tt.star)) {
            this.next();
            isGenerator = true;
          }
          this.parsePropertyName(prop);
        }
      } else {
        this.parsePropertyName(prop);
      }

      this.parseObjPropValue(
        prop,
        startPos,
        startLoc,
        isGenerator,
        isAsync,
        isPattern,
        refShorthandDefaultPos,
        containsEsc,
      );
      this.checkPropClash(prop, propHash);

      if (prop.shorthand) {
        this.addExtra(prop, 'shorthand', true);
      }

      node.properties.push(prop);
    }

    if (firstRestLocation !== null) {
      this.unexpected(
        firstRestLocation,
        'The rest element has to be the last element when destructuring',
      );
    }

    if (decorators.length) {
      this.raise(
        this.state.start,
        'You have trailing decorators with no property',
      );
    }

    return this.finishNode(
      node,
      isPattern ? 'ObjectPattern' : 'Object',
    );
  }

  isGetterOrSetterMethod(prop, isPattern) {
    return (
      !isPattern &&
      !prop.computed &&
      prop.key.type === 'Identifier' &&
      (prop.key.name === 'get' || prop.key.name === 'set') &&
      (this.match(tt.string) || // get "string"() {}
      this.match(tt.num) || // get 1() {}
      this.match(tt.bracketL) || // get ["string"]() {}
      this.match(tt.name) || // get foo() {}
        !!this.state.type.keyword) // get debugger() {}
    );
  }

  // get methods aren't allowed to have any parameters
  // set methods must have exactly 1 parameter which is not a rest parameter
  checkGetterSetterParams(method) {
    const paramCount = method.kind === 'get' ? 0 : 1;
    const { start } = method;
    if (method.params.length !== paramCount) {
      if (method.kind === 'get') {
        this.raise(start, 'getter must not have any formal parameters');
      } else {
        this.raise(start, 'setter must have exactly one formal parameter');
      }
    }

    if (method.kind === 'set' && method.params[0].type === 'RestElement') {
      this.raise(
        start,
        'setter function argument must not be a rest parameter',
      );
    }
  }

  parseObjectMethod(
    prop,
    isGenerator,
    isAsync,
    isPattern,
    containsEsc,
  ) {
    if (isAsync || isGenerator || this.match(tt.parenL)) {
      if (isPattern) this.unexpected();
      prop.kind = 'method';
      prop.method = true;
      return this.parseMethod(
        prop,
        isGenerator,
        isAsync,
        /* isConstructor */ false,
        'ObjectMethod',
      );
    }

    if (!containsEsc && this.isGetterOrSetterMethod(prop, isPattern)) {
      if (isGenerator || isAsync) this.unexpected();
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      this.parseMethod(
        prop,
        /* isGenerator */ false,
        /* isAsync */ false,
        /* isConstructor */ false,
        'ObjectMethod',
      );
      this.checkGetterSetterParams(prop);
      return prop;
    }

    return false;
  }

  parseObjectProperty(
    prop,
    startPos,
    startLoc,
    isPattern,
    refShorthandDefaultPos,
  ) {
    prop.shorthand = false;

    if (this.eat(tt.colon)) {
      prop.value = isPattern
        ? this.parseMaybeDefault(this.state.start, this.state.startLoc)
        : this.parseMaybeAssign(refShorthandDefaultPos);

      return this.finishNode(prop, 'ObjectProperty');
    }

    if (!prop.computed && prop.key.type === 'Identifier') {
      if (isPattern) {
        prop.value = this.parseMaybeDefault(
          startPos,
          startLoc,
          prop.key.__clone(),
        );
      } else if (this.match(tt.eq) && refShorthandDefaultPos) {
        if (!refShorthandDefaultPos.start) {
          refShorthandDefaultPos.start = this.state.start;
        }
        prop.value = this.parseMaybeDefault(
          startPos,
          startLoc,
          prop.key.__clone(),
        );
      } else {
        prop.value = prop.key.__clone();
      }
      prop.shorthand = true;

      return this.finishNode(prop, 'ObjectProperty');
    }

    return false;
  }

  parseObjPropValue(
    prop,
    startPos,
    startLoc,
    isGenerator,
    isAsync,
    isPattern,
    refShorthandDefaultPos,
    containsEsc
  ) {
    const node =
      this.parseObjectMethod(
        prop,
        isGenerator,
        isAsync,
        isPattern,
        containsEsc,
      ) ||
      this.parseObjectProperty(
        prop,
        startPos,
        startLoc,
        isPattern,
        refShorthandDefaultPos,
      );

    if (!node) this.unexpected();

    // $FlowFixMe
    return node;
  }

  parsePropertyName(prop) {
    if (this.eat(tt.bracketL)) {
      prop.computed = true;
      prop.key = this.parseExpression();
      this.expect(tt.bracketR);
    } else {
      const oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      // We check if it's valid for it to be a private name when we push it.
      prop.key =
        this.match(tt.num) || this.match(tt.string)
          ? this.parseExprAtom()
          : this.parseIdentifier();

      this.state.inPropertyName = oldInPropertyName;
    }

    return prop.key;
  }

  // Parse an Array Expression

  parseArrayExpression(refShorthandDefaultPos) {
    const node = this.startNode();
    this.next();
    node.elements = this.parseExprList(
      tt.bracketR,
      true,
      refShorthandDefaultPos,
    );
    return this.finishNode(node, 'Array');
  }

  // Initialize empty function node.

  initFunction(node, isAsync) {
    node.id = null;
    node.generator = false;
    node.async = !!isAsync;
    return this;
  }

  // Parse object or class method.

  parseMethod(
    node,
    isGenerator,
    isAsync,
    isConstructor,
    type,
  ) {
    const oldInFunc = this.state.inFunction;
    const oldInMethod = this.state.inMethod;
    const oldInGenerator = this.state.inGenerator;
    this.state.inFunction = true;
    this.state.inMethod = node.kind || true;
    this.state.inGenerator = isGenerator;

    this.initFunction(node, isAsync);
    node.generator = !!isGenerator;
    const allowModifiers = isConstructor; // For TypeScript parameter properties
    this.parseFunctionParams(node, allowModifiers);
    this.parseFunctionBodyAndFinish(node, type, false);

    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inGenerator = oldInGenerator;

    return node;
  }

  // Parse arrow function expression.
  // If the parameters are provided, they will be converted to an
  // assignable list.
  parseArrowExpression(
    node,
    params,
    isAsync
  ) {
    const oldInFunc = this.state.inFunction;
    this.state.inFunction = true;
    this.initFunction(node, isAsync);
    if (params) this.setArrowFunctionParameters(node, params);

    this.parseFunctionMods(node);

    const oldInGenerator = this.state.inGenerator;
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.inGenerator = false;
    this.state.maybeInArrowParameters = false;
    this.parseFunctionBody(node, true, false, true);
    this.state.inGenerator = oldInGenerator;
    this.state.inFunction = oldInFunc;
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

    return this.finishNode(node, 'ArrowFunction');
  }

  setArrowFunctionParameters(
    node,
    params
  ) {
    node.params = this.toAssignableList(
      params,
      true,
      'arrow function parameters',
    );
  }

  /* eslint-disable class-methods-use-this */
  isStrictBody(node) {
    const isBlockStatement = node.body.type === 'BlockStatement';

    if (isBlockStatement && node.body.directives.length) {
      for (const directive of node.body.directives) {
        if (directive.value.value === 'use strict') {
          return true;
        }
      }
    }

    return false;
  }
  /* eslint-enable class-methods-use-this */

  parseFunctionBodyAndFinish(
    node,
    type,
    allowExpressionBody
  ) {
    this.parseFunctionBody(node, allowExpressionBody);
    this.finishNode(node, type);
  }

  // Parse function body and check parameters.
  parseFunctionBody(node, allowExpression, noCheck = false, isArrow = false) {
    const oldInParameters = this.state.inParameters;
    const oldInAsync = this.state.inAsync;
    this.state.inParameters = false;
    this.state.inAsync = node.async;
    // Start a new scope with regard to labels and the `inGenerator`
    // flag (restore them to their old value afterwards).
    const oldInGen = this.state.inGenerator;
    const oldInFunc = this.state.inFunction;
    this.state.inGenerator = node.generator;
    this.state.inFunction = true;
    node.body = this.parseBlock(allowExpression, isArrow);
    this.state.inFunction = oldInFunc;
    this.state.inGenerator = oldInGen;
    this.state.inAsync = oldInAsync;

    if (!noCheck) this.checkFunctionNameAndParams(node, allowExpression);
    this.state.inParameters = oldInParameters;
  }

  checkFunctionNameAndParams(
    node,
    isArrowFunction
  ) {
    // If this is a strict mode function, verify that argument names
    // are not repeated, and it does not try to bind the words `eval`
    // or `arguments`.
    const isStrict = this.isStrictBody(node);
    // Also check for arrow functions
    const checkLVal = this.state.strict || isStrict || isArrowFunction;

    const oldStrict = this.state.strict;
    if (isStrict) this.state.strict = isStrict;

    if (checkLVal) {
      const nameHash = Object.create(null);
      if (node.id) {
        this.checkLVal(node.id, true, undefined, 'function name');
      }
      for (const param of node.params) {
        if (isStrict && param.type !== 'Identifier') {
          this.raise(param.start, 'Non-simple parameter in strict mode');
        }
        this.checkLVal(param, true, nameHash, 'function parameter list');
      }
    }
    this.state.strict = oldStrict;
  }

  // Parses a comma-separated list of expressions, and returns them as
  // an array. `close` is the token type that ends the list, and
  // `allowEmpty` can be turned on to allow subsequent commas with
  // nothing in between them to be parsed as `null` (which is needed
  // for array literals).

  parseExprList(
    close,
    allowEmpty,
    refShorthandDefaultPos,
  ) {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(close)) break;
      }

      elts.push(this.parseExprListItem(allowEmpty, refShorthandDefaultPos));
    }
    return elts;
  }

  parseExprListItem(
    allowEmpty,
    refShorthandDefaultPos,
    refNeedsArrowPos,
    refTrailingCommaPos
  ) {
    let elt;
    if (allowEmpty && this.match(tt.comma)) {
      elt = null;
    } else if (this.match(tt.ellipsis)) {
      const spreadNodeStartPos = this.state.start;
      const spreadNodeStartLoc = this.state.startLoc;
      elt = this.parseParenItem(
        this.parseSpread(refShorthandDefaultPos, refNeedsArrowPos),
        spreadNodeStartPos,
        spreadNodeStartLoc,
      );

      if (refTrailingCommaPos && this.match(tt.comma)) {
        refTrailingCommaPos.start = this.state.start;
      }
    } else {
      elt = this.parseMaybeAssign(
        refShorthandDefaultPos,
        this.parseParenItem,
        refNeedsArrowPos,
      );
    }
    return elt;
  }

  // Parse the next token as an identifier.

  parseIdentifier() {
    const node = this.startNode();
    const name = this.parseIdentifierName();
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node, 'Identifier');
  }

  parseIdentifierName() {
    let name;

    if (this.match(tt.name)) {
      name = this.state.value;
    } else {
      throw this.unexpected();
    }
    this.next();
    return name;
  }

  // Parses await expression inside async function.

  parseAwait() {
    // istanbul ignore next: this condition is checked at the call site so won't be hit here
    const node = this.startNode();
    if (!this.state.inAsync) {
      this.unexpected();
    }
    this.next();
    if (this.match(tt.star)) {
      this.raise(
        node.start,
        'await* has been removed from the async functions proposal. Use Promise.all() instead.',
      );
    }
    node.argument = this.parseMaybeUnary();
    return this.finishNode(node, 'AwaitExpression');
  }

  // Parses yield expression inside generator.

  parseYield() {
    const node = this.startNode();

    this.next();
    if (
      this.match(tt.semi) ||
      (!this.match(tt.star) && !this.state.type.startsExpr)
    ) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(tt.star);
      node.argument = this.parseMaybeAssign();
    }
    return this.finishNode(node, 'YieldExpression');
  }

  // Parse a function literal

  parseFunction(node, allowExpressionBody, isAsync, isStatement) {
    const oldInFunc = this.state.inFunction;
    const oldInMethod = this.state.inMethod;
    const oldInGenerator = this.state.inGenerator;
    const oldInClassProperty = this.state.inClassProperty;
    this.state.inFunction = true;
    this.state.inMethod = false;
    this.state.inClassProperty = false;


    this.initFunction(node, isAsync);

    this.parseFunctionMods(node);

    this.state.inGenerator = node.generator;
    if (this.match(tt.name)) {
      node.id = this.parseBindingIdentifier();
    } else if (isStatement) {
      this.unexpected(null, tt.name);
    }

    node.declares = isStatement;

    this.parseFunctionParams(node);
    this.parseFunctionBodyAndFinish(
      node,
      'Function',
      allowExpressionBody
    );

    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inGenerator = oldInGenerator;
    this.state.inClassProperty = oldInClassProperty;

    return node;
  }

  parseFunctionParams(node, allowModifiers) {
    const oldInParameters = this.state.inParameters;
    this.state.inParameters = true;

    this.expect(tt.parenL);
    node.params = this.parseBindingList(
      tt.parenR,
      /* allowEmpty */ false,
      allowModifiers
    );

    this.state.inParameters = oldInParameters;
  }

  parseFunctionMods(node) {
    while (node) {
      switch (this.state.type) {
      case tt.star:
        node.generator = true;
        this.next();
        break;
      case tt.modulo:
        node.curried = true;
        this.next();
        break;
      default:
        return;
      }
    }
  }

  parseMember() {
    const slice = this.startNode();
    const atEnd = this.eat(tt.colon);
    const member = this.parseExpression();
    if (this.eat(tt.colon) || atEnd) {
      slice.beginning = member;
      if (atEnd) {
        slice.finish = slice.beginning;
        slice.beginning = {
          type: 'NumericLiteral',
          value: 0
        };
      } else if (this.match(tt.bracketR)) {
        slice.finish = null;
      } else {
        slice.finish = this.parseExpression();
      }
      return this.finishNode(slice, 'SliceMember');
    }
    return member;
  }
}
