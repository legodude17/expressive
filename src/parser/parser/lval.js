// @flow

import { types as tt } from '../tokenizer/types';
import { isKeyword } from '../util/identifier';
import NodeUtils from './node';

export default class LValParser extends NodeUtils {
  // Convert existing expression atom to assignable pattern
  // if possible.

  toAssignable(
    node,
    isBinding,
    contextDescription,
  ) {
    if (node) {
      switch (node.type) {
      case 'Identifier':
      case 'ObjectPattern':
      case 'ArrayPattern':
      case 'AssignmentPattern':
        break;

      case 'ObjectExpression':
        node.type = 'ObjectPattern';
        for (let index = 0; index < node.properties.length; index++) {
          const prop = node.properties[index];
          const isLast = index === node.properties.length - 1;
          this.toAssignableObjectExpressionProp(prop, isBinding, isLast);
        }
        break;

      case 'ObjectProperty':
        this.toAssignable(node.value, isBinding, contextDescription);
        break;

      case 'SpreadElement': {
        this.checkToRestConversion(node);

        node.type = 'RestElement';
        const arg = node.argument;
        this.toAssignable(arg, isBinding, contextDescription);
        break;
      }

      case 'ArrayExpression':
        node.type = 'ArrayPattern';
        this.toAssignableList(node.elements, isBinding, contextDescription);
        break;

      case 'AssignmentExpression':
        if (node.operator === '=') {
          node.type = 'AssignmentPattern';
          delete node.operator;
        } else {
          this.raise(
            node.left.end,
            "Only '=' operator can be used for specifying default value.",
          );
        }
        break;

      case 'CollectionLiteral':
        node.type = 'CollectionPattern';
        node.pattern = node.collection;
        node.destructurer = node.constructor;
        delete node.constructor;
        delete node.collection;
        this.toAssignable(node.pattern);
        this.toAssignable(node.destructurer);
        break;

      case 'MemberExpression':
        if (!isBinding) break;

      default: {
        const message =
            `Invalid left-hand side${
              contextDescription
                ? ` in ${contextDescription}`
                : /* istanbul ignore next */ ' expression'}`;
        this.raise(node.start, message);
      }
      }
    }
    return node;
  }

  toAssignableObjectExpressionProp(
    prop,
    isBinding,
    isLast
  ) {
    if (prop.type === 'ObjectMethod') {
      const error =
        prop.kind === 'get' || prop.kind === 'set'
          ? "Object pattern can't contain getter or setter"
          : "Object pattern can't contain methods";

      this.raise(prop.key.start, error);
    } else if (prop.type === 'SpreadElement' && !isLast) {
      this.raise(
        prop.start,
        'The rest element has to be the last element when destructuring',
      );
    } else {
      this.toAssignable(prop, isBinding, 'object destructuring pattern');
    }
  }

  // Convert list of expression atoms to binding list.

  toAssignableList(
    exprList,
    isBinding,
    contextDescription,
  ) {
    let end = exprList.length;
    if (end) {
      const last = exprList[end - 1];
      if (last && last.type === 'RestElement') {
        --end;
      } else if (last && last.type === 'SpreadElement') {
        last.type = 'RestElement';
        const arg = last.argument;
        this.toAssignable(arg, isBinding, contextDescription);
        if (
          [
            'Identifier',
            'MemberExpression',
            'ArrayPattern',
            'ObjectPattern'
          ].indexOf(arg.type) === -1
        ) {
          this.unexpected(arg.start);
        }
        --end;
      }
    }
    for (let i = 0; i < end; i++) {
      const elt = exprList[i];
      if (elt && elt.type === 'SpreadElement') {
        this.raise(
          elt.start,
          'The rest element has to be the last element when destructuring',
        );
      }
      if (elt) this.toAssignable(elt, isBinding, contextDescription);
    }
    return exprList;
  }

  // Parses spread element.

  parseSpread(
    refShorthandDefaultPos,
    refNeedsArrowPos,
  ) {
    const node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(
      false,
      refShorthandDefaultPos,
      undefined,
      refNeedsArrowPos,
    );
    return this.finishNode(node, 'SpreadElement');
  }

  parseRest() {
    const node = this.startNode();
    this.next();
    node.argument = this.parseBindingAtom();
    return this.finishNode(node, 'RestElement');
  }

  shouldAllowYieldIdentifier() {
    return (
      this.match(tt._yield) && !this.state.strict && !this.state.inGenerator
    );
  }

  parseBindingIdentifier() {
    const id = this.parseIdentifier(this.shouldAllowYieldIdentifier());
    if (this.eat(tt.hash)) {
      const node = this.startNode();
      node.destructurer = id;
      if (this.match(tt.braceL)) {
        node.pattern = this.parseObj(true);
      } else if (this.match(tt.bracketL)) {
        const collection = this.startNode();
        this.next();
        collection.elements = this.parseBindingList(tt.bracketR, true);
        node.pattern = this.finishNode(collection, 'ArrayPattern');
      } else if (this.match(tt.name)) {
        node.pattern = this.parseIdentifier(false);
      } else {
        this.unexpected(null, 'Invalid pattern in ColletionPattern');
      }
      return this.finishNode(node, 'CollectionPattern');
    }
    return id;
  }

  // Parses lvalue (assignable) atom.
  parseBindingAtom() {
    if (isKeyword(this.state.type.label)) this.unexpected(null, 'Unexpected keyword in binding');
    switch (this.state.type) {
    case tt.name:
      return this.parseBindingIdentifier();

    case tt.bracketL: {
      const node = this.startNode();
      this.next();
      node.elements = this.parseBindingList(tt.bracketR, true);
      return this.finishNode(node, 'ArrayPattern');
    }

    case tt.braceL:
      return this.parseObj(true);

    default:
      throw this.unexpected();
    }
  }

  parseBindingList(
    close,
    allowEmpty
  ) {
    const elts = [];
    let first = true;
    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
      }
      if (allowEmpty && this.match(tt.comma)) {
        elts.push(null);
      } else if (this.eat(close)) {
        break;
      } else if (this.match(tt.ellipsis)) {
        elts.push(this.parseRest());
        this.expect(close);
        break;
      } else {
        elts.push(this.parseBindingAtom());
      }
    }
    return elts;
  }

  parseAssignableListItem(
    allowModifiers,
    decorators,
  ) {
    const left = this.parseMaybeDefault();
    const elt = this.parseMaybeDefault(left.start, left.loc.start, left);
    if (decorators.length) {
      left.decorators = decorators;
    }
    return elt;
  }

  // Parses assignment pattern around given atom if possible.

  parseMaybeDefault(
    startPos,
    startLoc,
    left,
  ) {
    startLoc = startLoc || this.state.startLoc;
    startPos = startPos || this.state.start;
    left = left || this.parseBindingAtom();
    if (!this.eat(tt.eq)) return left;

    const node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node, 'AssignmentPattern');
  }

  // Verify that a node is an lval — something that can be assigned
  // to.

  checkLVal(
    expr,
    isBinding,
    checkClashes,
    contextDescription
  ) {
    switch (expr.type) {
    case 'Identifier':
      if (checkClashes) {
        // we need to prefix this with an underscore for the cases where we have a key of
        // `__proto__`. there's a bug in old V8 where the following wouldn't work:
        //
        //   > var obj = Object.create(null);
        //   undefined
        //   > obj.__proto__
        //   null
        //   > obj.__proto__ = true;
        //   true
        //   > obj.__proto__
        //   null
        const key = `_${expr.name}`;

        if (checkClashes[key]) {
          this.raise(expr.start, 'Argument name clash in strict mode');
        } else {
          checkClashes[key] = true;
        }
      }
      break;

    case 'MemberExpression':
      if (isBinding) this.raise(expr.start, 'Binding member expression');
      break;

    case 'ObjectPattern':
      for (let prop of expr.properties) {
        if (prop.type === 'ObjectProperty') prop = prop.value;
        this.checkLVal(
          prop,
          isBinding,
          checkClashes,
          'object destructuring pattern',
        );
      }
      break;

    case 'ArrayPattern':
      for (const elem of expr.elements) {
        if (elem) {
          this.checkLVal(
            elem,
            isBinding,
            checkClashes,
            'array destructuring pattern',
          );
        }
      }
      break;

    case 'AssignmentPattern':
      this.checkLVal(
        expr.left,
        isBinding,
        checkClashes,
        'assignment pattern',
      );
      break;

    case 'RestElement':
      this.checkLVal(expr.argument, isBinding, checkClashes, 'rest element');
      break;

    case 'CollectionPattern':
      this.checkLVal(
        expr.pattern,
        isBinding,
        checkClashes,
        'collection literal pattern',
      );
      this.checkLVal(
        expr.destructurer,
        isBinding,
        checkClashes,
        'collection literal collection name',
      );
      break;

    default: {
      const message =
          `${isBinding
            ? /* istanbul ignore next */ 'Binding invalid'
            : 'Invalid'
          } left-hand side${
            contextDescription
              ? ` in ${contextDescription}`
              : /* istanbul ignore next */ ' expression'}`;
      this.raise(expr.start, message);
    }
    }
  }

  checkToRestConversion(node) {
    const validArgumentTypes = ['Identifier', 'MemberExpression'];

    if (validArgumentTypes.indexOf(node.argument.type) !== -1) {
      return;
    }

    this.raise(node.argument.start, "Invalid rest operator's argument");
  }
}
