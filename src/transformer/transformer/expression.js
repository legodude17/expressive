import UtilTransformer from './util';

const MI = {
  type: 'Identifier',
  name: '_m'
};

const NF = {
  type: 'Identifier',
  name: '__not__found'
};

export default class Expression extends UtilTransformer {
  If(node) {
    if (node.isStatement) return this.iterate(node, ['test', 'consequent', 'alternate'], 'IfStatement');
    return {
      type: 'CallExpression',
      callee: {
        type: 'ConditionalExpression',
        test: this.walk(node.test),
        consequent: this.blockToFunction(this.walk(node.consequent), false),
        alternate: this.blockToFunction(this.walk(node.alternate), false)
      },
      arguments: []
    };
  }
  DoWhile(node) {
    if (node.isStatement) return this.iterate(node, ['body, test'], 'DoWhileStatement');
    return this.usePolyfill('doWhile', this.walk(node.test), this.blockToFunction(this.walk(node.body), false));
  }
  Class(node) {
    if (node.declares) return this.iterate(node, ['id', 'body'], 'ClassDeclaration');
    return this.iterate(node, ['id', 'body'], 'ClassExpression');
  }
  ClassBody(node) {
    return this.iterate(node, ['body']);
  }
  ClassMethod(node) {
    return this.ObjectMethod(node);
  }
  Function(node) {
    const newNode = this.clone(node);
    this.insertReturn(newNode.body);
    if (node.declares) return this.iterate(newNode, ['id', 'params', 'body'], 'FunctionDeclaration');
    return this.iterate(newNode, ['id', 'params', 'body'], 'FunctionExpression');
  }
  Switch(node) {
    if (node.isStatement) return this.iterate(node, ['discriminant', 'cases'], 'SwitchStatement');
    return this.usePolyfill(
      'switch',
      this.walk(node.discriminant),
      this.walk(node.cases).map(this.switchCaseToFunction, this)
    );
  }
  SwitchCase(node) {
    const newNode = this.clone(node);
    newNode.consequent = this.walk(node.consequent.type === 'Block' ?
      node.consequent.body.slice() :
      [node.consequent.expression], true);
    return newNode;
  }
  While(node) {
    if (node.isStatement) return this.iterate(node, ['body, test'], 'WhileStatement');
    return this.usePolyfill('while', this.walk(node.test), this.blockToFunction(this.walk(node.body)));
  }
  VariableDeclaration(node) {
    return this.iterate(node, ['declarations']);
  }
  VariableDeclarator(node) {
    if (node.id.type === 'CollectionPattern') {
      return this.collectionPattern(node, 'id', 'init');
    }
    return this.iterate(node, ['id', 'init']);
  }
  Program(node) {
    return this.iterate(node, ['body'], 'Program', true);
  }
  File(node) {
    return this.iterate(node, ['program']);
  }
  SingleExpression(node) {
    return {
      type: 'BlockStatement',
      body: [this.walk(node.expression, true)]
    };
  }
  Block(node) {
    return this.iterate(node, ['body'], 'BlockStatement', true);
  }
  Continue(node) {
    return this.iterate(node, [], 'ContinueStatement');
  }
  CallExpression(node) {
    const newNode = this.iterate(node, ['id', 'arguments']);
    if (newNode.blockParam) {
      newNode.arguments.push(this.walk(newNode.blockParam));
      delete newNode.blockParam;
    }
    return newNode;
  }
  UpdateExpression(node) {
    return this.iterate(node, ['argument']);
  }
  AssignmentExpression(node) {
    if (node.right.type === 'CollectionPattern') {
      return this.collectionPattern(node, 'left', 'right');
    }
    return this.iterate(node, ['left', 'right']);
  }
  Object(node) {
    return this.iterate(node, ['properties'], 'ObjectExpression');
  }
  ObjectProperty(node) {
    return this.iterate(node, ['key', 'value']);
  }
  ObjectPattern(node) {
    return this.iterate(node, ['properties']);
  }
  Array(node) {
    return this.iterate(node, ['elements'], 'ArrayExpression');
  }
  ObjectMethod(node) {
    const newNode = this.iterate(node, ['key', 'body']);
    this.insertReturn(newNode.body);
    return newNode;
  }
  ArrayPattern(node) {
    return this.iterate(node, ['elements']);
  }
  RestElement(node) {
    return this.iterate(node, ['argument']);
  }
  Return(node) {
    return this.iterate(node, ['argument'], 'ReturnStatement');
  }
  CollectionLiteral(node) {
    return {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: this.walk(node.constructor),
        property: {
          type: 'Identifier',
          name: 'from'
        }
      },
      arguments: [this.walk(node.collection)]
    };
  }
  CollectionPattern(node) {
    return this.walk(node.pattern);
  }
  MemberExpression(node) {
    if (node.property.type === 'SliceMember') {
      return {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: this.walk(node.object),
          property: {
            type: 'Identifier',
            name: 'slice'
          }
        },
        arguments: [
          this.walk(node.property.beginning),
          this.walk(node.property.finish)
        ]
      };
    }
    return this.iterate(node, ['object', 'property']);
  }
  BinaryExpression(node) {
    if (node.operator === '|>') {
      return {
        type: 'CallExpression',
        callee: this.walk(node.right),
        arguments: [this.walk(node.left)]
      };
    }
    return this.iterate(node, ['left', 'right']);
  }
  LogicalExpression(node) {
    return this.iterate(node, ['left', 'right']);
  }
  UnaryExpression(node) {
    return this.iterate(node, ['argument']);
  }
  Cond(node) {
    return this.usePolyfill(
      'cond',
      this.walk(node.descriminent),
      this.walk(node.items)
    );
  }
  CondItem(node) {
    const newNode = {
      type: 'ArrayExpression',
      elements: [
        this.walk(node.matcher),
        {
          type: 'ArrowFunctionExpression',
          params: this.state.vars.map(v => (v ? {
            type: 'Identifier',
            name: v
          } : {
            type: 'Identifier',
            name:
        this.state.randomVar()
          })),
          body: this.blockToFunctionBody(this.walk(node.consequent))
        }
      ]
    };
    this.state.clearVars();
    return newNode;
  }
  CollectionMatcher(node) {
    const id = this.walk(node.id);
    return {
      type: 'ArrowFunctionExpression',
      params: [MI],
      body: {
        type: 'ConditionalExpression',
        test: this.usePolyfill('constructor', MI, id),
        consequent: {
          type: 'ArrayExpression',
          elements: [{
            type: 'CallExpression',
            callee: this.walk(node.collection),
            arguments: [{
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: id,
                property: {
                  type: 'Identifier',
                  name: 'toJS'
                }
              },
              arguments: [MI]
            }]
          }]
        },
        alternate: NF
      }
    };
  }
  VariableMatcher(node) {
    this.state.addVar(node.id);
    return {
      type: 'ArrowFunctionExpression',
      params: [MI],
      body: {
        type: 'ArrayExpression',
        elements: [MI]
      }
    };
  }
  ObjectMatcher(node) {
    const props = this.walk(node.props);
    return {
      type: 'ArrowFunctionExpression',
      params: [MI],
      body: {
        type: 'ConditionalExpression',
        test: {
          type: 'MemberExpression',
          object: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'ArrayExpression',
                elements: props
              },
              property: {
                type: 'Identifier',
                name: 'filter'
              }
            },
            arguments: [{
              type: 'ArrowFunctionExpression',
              params: [{
                type: 'Identifier',
                name: 'v'
              }],
              body: {
                type: 'BinaryExpression',
                operator: '!==',
                left: {
                  type: 'CallExpression',
                  callee: {
                    type: 'Identifier',
                    name: 'v'
                  },
                  arguments: [MI]
                },
                right: NF
              }
            }]
          },
          property: {
            type: 'Identifier',
            name: 'length'
          }
        },
        consequent: {
          type: 'ArrayExpression',
          elements: props.map(n => ({
            type: 'CallExpression',
            callee: n,
            arguments: [MI]
          }))
        },
        alternate: NF
      }
    };
  }
  ObjectMatcherProperty(node) {
    if (node.computed) {
      this.state.vars.push(null);
    } else {
      this.state.addVar(node.key);
    }
    return {
      type: 'ArrowFunctionExpression',
      params: [MI],
      body: {
        type: 'ConditionalExpression',
        test: node.value ? {
          type: 'BinaryExpression',
          operator: '!==',
          left: {
            type: 'CallExpression',
            callee: this.walk(node.value),
            arguments: [{
              type: 'MemberExpression',
              object: MI,
              property: this.walk(node.key),
              computed: node.computed
            }]
          },
          right: NF
        } : {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: MI,
            property: {
              type: 'Identifier',
              name: 'hasOwnProperty'
            }
          },
          arguments: [this.keyToExpression(node.key, node.computed)]
        },
        consequent: {
          type: 'MemberExpression',
          object: MI,
          property: this.walk(node.key),
          computed: node.computed
        },
        alternate: NF
      }
    };
  }
  ExpressionMatcher(node) {
    const expr = this.walk(node.expression);
    return {
      type: 'ArrowFunctionExpression',
      params: [MI],
      body: {
        type: 'ConditionalExpression',
        test: {
          type: 'BinaryExpression',
          operator: '===',
          right: MI,
          left: expr
        },
        consequent: {
          type: 'ArrayExpression',
          elements: [expr]
        },
        alternate: NF
      }
    };
  }
  ArrowFunction(node) {
    const newNode = this.iterate(
      node,
      ['params', 'body'],
      node.kind === 'Thick' ?
        'ArrowFunctionExpression' :
        'FunctionExpression'
    );
    delete newNode.kind;
    this.insertReturn(newNode.body);
    return newNode.curried ? this.usePolyfill('curry', newNode, newNode.params.length) : newNode;
  }
  BlockParam(node) {
    const newNode = this.iterate(node, ['body', 'params'], 'FunctionExpression');
    return newNode;
  }
  OptionalCallExpression(node) {
    return this.usePolyfill('optionalCall', this.walk(node.callee), this.walk(node.arguments));
  }
  OptionalMemberExpression(node) {
    return this.usePolyfill('optionalProp', this.walk(node.object), this.keyToExpression(node.property, node.computed));
  }
  BindExpression(node) {
    if (node.object === null) {
      const callee = this.walk(node.callee);
      if (callee.type !== 'MemberExpression') throw new Error('Invalid bind!');
      return {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: callee,
          property: {
            type: 'Identifier',
            name: 'bind'
          }
        },
        arguments: [
          callee.object
        ]
      };
    }
    return {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: this.walk(node.callee),
        property: {
          type: 'Identifier',
          name: 'bind'
        }
      },
      arguments: [this.walk(node.object)]
    };
  }
}
