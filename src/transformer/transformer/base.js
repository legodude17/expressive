import State from './State';

function matches(type, matcher) {
  if (matcher.startsWith('*')) {
    return type.endsWith(matcher.slice(1));
  }
  if (matcher.endsWith('*')) {
    return type.startsWith(matcher.slice(0, -1));
  }
  if (matcher.includes(',')) {
    return matcher.split(',').includes(type);
  }
  return type === matcher;
}

const STATEMENT_TYPES = ['Import*', 'Export*', 'VariableDeclaration'];

function isStatement(type) {
  return type.includes('Statement') || STATEMENT_TYPES.filter(s => matches(type, s)).length !== 0;
}

export default class Base {
  constructor() {
    this.handlers = {};
    this.state = new State();
  }

  walk(thing, statement = false) {
    if (Array.isArray(thing)) return thing.map(v => this.walk(v, statement));
    if (!thing) return thing;
    const node = this.transformNode(thing);
    delete node.isStatement;
    delete node.declares;
    if (statement && !isStatement(node.type)) {
      return {
        type: 'ExpressionStatement',
        expression: node
      };
    }
    return node;
  }

  transformNode(node) {
    return this.normalize(this.getTransformer(node.type)(node), node);
  }

  getTransformer(type) {
    if (typeof this[type] === 'function') {
      return this[type].bind(this);
    }
    if (this.getHandler(type)) {
      return this.getHandler(type);
    }
    throw new Error(`Not found: ${type}`);
    // return (_ => _);
  }

  normalize(thing, node) {
    if (typeof thing === 'string') {
      this.checkValidType(thing);
      node.type = thing;
      return node;
    }
    this.checkValidNode(thing);
    return thing;
  }
  /* eslint-disable class-methods-use-this */
  clone(node) {
    return Object.assign({}, node);
  }
  /* eslint-enable */

  iterate(node, keys, type = node.type, statement = false) {
    const newNode = this.clone(node);
    newNode.type = type;
    keys.forEach(key => { newNode[key] = this.walk(node[key], statement); });
    return newNode;
  }

  checkValidNode() { } // eslint-disable-line class-methods-use-this
  checkValidType() { } // eslint-disable-line class-methods-use-this

  registerHandler(matcher, func = (node => node)) {
    if (this.handlers[matcher]) {
      throw new Error(`Duplicate Handler ${matcher}`);
    }
    this.handlers[matcher] = func;
  }

  getHandler(type) {
    const keys = Object.keys(this.handlers);
    const handlers = keys.filter(matcher => matches(type, matcher));
    return this.handlers[handlers[0]];
  }
}
