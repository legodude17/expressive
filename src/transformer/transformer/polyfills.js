import BaseTransformer from './base';

const POLYFILLS = {
  doWhile: {
    text: 'function do__while__(a,b){var res;do{res=b();}while(a());return res;}',
    build: (test, body) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'do__while__'
      },
      arguments: [
        {
          type: 'ArrowFunctionExpression',
          params: [],
          body: test
        },
        body
      ]
    })
  },
  switch: {
    text: 'const cont__inue__={};const def__ault__={};function switch__(a,b,r,d,v){for(v of b){if(v[0]===def__ault__){d=v[1];continue;}if(v[0 ===a){r=v[1]();if(r[1] !== cont__inue__){break;}}};if(!r)r=d&&d();return r[0];}', // eslint-disable-line max-len
    build: (desc, cases) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'switch__'
      },
      arguments: [
        desc,
        {
          type: 'ArrayExpression',
          elements: cases
        }
      ]
    })
  },
  while: {
    text: 'function while__(a,b){var res;while(a()){res = b()}return res;}',
    build: (test, body) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'while__'
      },
      arguments: [
        {
          type: 'ArrowFunctionExpression',
          params: [],
          body: test
        },
        body
      ]
    })
  },
  cond: {
    text: 'const __not__found = {};function cond__(a,b,v){var r;for(v of b){const r=v[0](a);if(r!==__not__found)return v[1](...r)}}', // eslint-disable-line
    build: (test, items) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'cond__'
      },
      arguments: [
        test,
        {
          type: 'ArrayExpression',
          elements: items.map(v => v) // TODO: Better thing
        }
      ]
    })
  },
  // HACK: Atom breaks if this isn't quoted, but eslint doesn't like it quoted
  'constructor': { // eslint-disable-line
    text: 'function constructor__(a,b){if(typeof b.is === "function")return b.is(a);return a.constructor === b;}',
    build: (item, constr) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'constructor__'
      },
      arguments: [
        item,
        constr
      ]
    })
  },
  curry: {
    text: 'const __ = {};let _kn=(f,n,m=(r,s)=>(...a)=>(s=r.map(v=>v===__?a.shift():v).concat(a)).length>=n?f(...s.slice(0,n+1)):m(s))=>m([]);', // eslint-disable-line
    build: (node, n) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: '_kn'
      },
      arguments: [node, {
        type: 'NumericLiteral',
        value: n
      }]
    })
  },
  optionalCall: {
    text: 'function opt__call__(a,b){if(typeof a === "function")return a(...(b()));return a;}',
    build: (callee, args) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'opt__call__'
      },
      arguments: [
        callee,
        {
          type: 'ArrowFunctionExpression',
          params: [],
          body: {
            type: 'ArrayExpression',
            elements: args
          }
        }
      ]
    })
  },
  optionalProp: {
    text: 'function opt__prop__(a,b){if(a==null)return undefined;return a[b()];}',
    build: (callee, arg) => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'opt__prop__'
      },
      arguments: [
        callee,
        {
          type: 'ArrowFunctionExpression',
          params: '',
          body: arg
        }
      ]
    })
  },
  typeof: {
    // eslint-disable-next-line max-len
    text: 'function typeof__(a){return {object:a?Array.isArray(a)&&"array":"null",number:a!==a&&"NaN"}[typeof a] || typeof a}',
    build: arg => ({
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'typeof__'
      },
      arguments: [arg]
    })
  }
};

export default class PolyfillTransformer extends BaseTransformer {
  constructor() {
    super();
    this.polyfills = [];
    this.polyfillText = '';
  }

  addPolyfill(polyfill) {
    this.polyfills.push(polyfill);
    this.polyfillText += POLYFILLS[polyfill].text;
  }

  usePolyfill(polyfill, ...args) {
    if (!this.polyfills.includes(polyfill)) this.addPolyfill(polyfill);
    return POLYFILLS[polyfill].build(...args);
  }
}
