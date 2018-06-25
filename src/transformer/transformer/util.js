import PolyfillTransformer from './polyfills';

export default class UtilTransformer extends PolyfillTransformer {
  switchCaseToFunction(node) {
    return {
      type: 'ArrayExpression',
      elements: [
        node.test !== null ? node.test : {
          type: 'Identifier',
          name: 'def__ault__'
        },
        this.blockToFunction(node.consequent, true)
      ]
    };
  }
  blockToFunction(node, isSwitch) {
    const bbody = node.body || node;
    const body = bbody.slice(0, -1);
    const cont = (bbody.slice(-1)[0].type === 'ContinueStatement');
    if (!cont || !isSwitch) body.push(bbody.slice(-1)[0]);
    if (body.length === 0) {
      body.push({
        type: 'ExpressionStatement',
        expression: {
          type: 'Identifier',
          name: 'undefined'
        }
      });
    }
    this.insertReturn(body, n => (isSwitch ? {
      type: 'ArrayExpression',
      elements: [
        n,
        cont ? {
          type: 'Identifier',
          name: 'cont__inue__'
        } : {
          type: 'Identifier',
          name: 'undefined'
        }
      ]
    } : n));
    return {
      type: 'FunctionExpression',
      params: [],
      body: {
        type: 'BlockStatement',
        body
      }
    };
  }
  insertReturn(node, map = (_ => _)) {
    const body = node.body || node;
    const last = body.slice(-1)[0];
    if (!last) return;
    switch (last.type) {
    case 'ExpressionStatement':
      body[body.length - 1] = {
        type: 'ReturnStatement',
        argument: map(last.expression)
      };
      break;
    case 'IfStatement':
      this.insertReturn(node.consequent, map);
      if (node.alternate) this.insertReturn(node.alternate, map);
      break;
    case 'SwitchStatement':
      node.cases.forEach(v => this.insertReturn(v, map));
    case 'ReturnStatement':
      body[body.length - 1] = {
        type: 'ReturnStatement',
        argument: map(last.argument)
      };
      break;
    default:
      break;
    }
  }
  collectionPattern(node, collection, value) {
    return {
      type: node.type,
      [collection]: this.walk(node[collection].pattern),
      [value]: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: node[collection].destructurer,
          property: {
            type: 'Identifier',
            name: 'toJS'
          }
        },
        arguments: [this.walk(node[value])]
      }
    };
  }
  blockToFunctionBody(node) {
    this.insertReturn(node);
    return node;
  }
  keyToExpression(key, computed) {
    if (!computed) {
      return {
        type: 'StringLiteral',
        value: key.name
      };
    }
    return this.walk(key);
  }
}
