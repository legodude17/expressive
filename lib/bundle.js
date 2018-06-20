'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @flow

// A second optional argument can be given to further configure
// the parser process. These options are recognized:

var defaultOptions = {
  // Source type ("script" or "module") for different semantics
  sourceType: 'module',
  // Source filename.
  sourceFilename: undefined,
  // Line from which to start counting source. Useful for
  // integration with other tools.
  startLine: 1,
  // When enabled, await at the top level is not considered an
  // error.
  allowAwaitOutsideFunction: false,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program.
  allowImportExportEverywhere: false,
  // TODO
  allowSuperOutsideMethod: false,
  // An array of plugins to enable
  plugins: [],
  // TODO
  strictMode: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // Adds all parsed tokens to a `tokens` property on the `File` node
  tokens: false
};

// Interpret and default an options object

function getOptions() {
  var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var options = {};
  Object.keys(defaultOptions).forEach(function (key) {
    options[key] = opts[key] != null ? opts[key] : defaultOptions[key];
  });
  return options;
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).
//
// `isLoop` marks a keyword as starting a loop, which is important
// to know when parsing a label, in order to allow or disallow
// continue jumps to that label.

var beforeExpr = true;
var startsExpr = true;
var isLoop = true;
var isAssign = true;
var prefix = true;
var postfix = true;

var TokenType = function TokenType(label) {
  var conf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  classCallCheck(this, TokenType);

  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.rightAssociative = !!conf.rightAssociative;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop === 0 ? 0 : conf.binop || null;
  this.updateContext = null;
};

var KeywordTokenType = function (_TokenType) {
  inherits(KeywordTokenType, _TokenType);

  function KeywordTokenType(name) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, KeywordTokenType);

    options.keyword = name;

    return possibleConstructorReturn(this, (KeywordTokenType.__proto__ || Object.getPrototypeOf(KeywordTokenType)).call(this, name, options));
  }

  return KeywordTokenType;
}(TokenType);

var BinopTokenType = function (_TokenType2) {
  inherits(BinopTokenType, _TokenType2);

  function BinopTokenType(name, prec) {
    classCallCheck(this, BinopTokenType);
    return possibleConstructorReturn(this, (BinopTokenType.__proto__ || Object.getPrototypeOf(BinopTokenType)).call(this, name, { beforeExpr: beforeExpr, binop: prec }));
  }

  return BinopTokenType;
}(TokenType);

var types = {
  num: new TokenType('num', { startsExpr: startsExpr }),
  bigint: new TokenType('bigint', { startsExpr: startsExpr }),
  regexp: new TokenType('regexp', { startsExpr: startsExpr }),
  string: new TokenType('string', { startsExpr: startsExpr }),
  name: new TokenType('name', { startsExpr: startsExpr }),
  eof: new TokenType('eof'),

  // Punctuation token types.
  bracketL: new TokenType('[', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  bracketR: new TokenType(']'),
  braceL: new TokenType('{', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  braceBarL: new TokenType('{|', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  braceR: new TokenType('}'),
  braceBarR: new TokenType('|}'),
  parenL: new TokenType('(', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  parenR: new TokenType(')'),
  comma: new TokenType(',', { beforeExpr: beforeExpr }),
  semi: new TokenType(';', { beforeExpr: beforeExpr }),
  colon: new TokenType(':', { beforeExpr: beforeExpr }),
  doubleColon: new TokenType('::', { beforeExpr: beforeExpr }),
  dot: new TokenType('.'),
  question: new TokenType('?', { beforeExpr: beforeExpr }),
  questionDot: new TokenType('?.'),
  arrow: new TokenType('=>', { beforeExpr: beforeExpr }),
  arrowThin: new TokenType('->', { beforeExpr: beforeExpr }),
  template: new TokenType('template'),
  ellipsis: new TokenType('...', { beforeExpr: beforeExpr }),
  backQuote: new TokenType('`', { startsExpr: startsExpr }),
  dollarBraceL: new TokenType('${', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  at: new TokenType('@'),
  hash: new TokenType('#'),

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  eq: new TokenType('=', { beforeExpr: beforeExpr, isAssign: isAssign }),
  assign: new TokenType('_=', { beforeExpr: beforeExpr, isAssign: isAssign }),
  incDec: new TokenType('++/--', { prefix: prefix, postfix: postfix, startsExpr: startsExpr }),
  bang: new TokenType('!', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  round: new TokenType('~', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  truncate: new TokenType('~~', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  pipeline: new BinopTokenType('|>', 0),
  nullishCoalescing: new BinopTokenType('??', 1),
  logicalOR: new BinopTokenType('||', 1),
  logicalAND: new BinopTokenType('&&', 2),
  equality: new BinopTokenType('==/!=', 6),
  relational: new BinopTokenType('</>', 7),
  plusMin: new TokenType('+/-', {
    beforeExpr: beforeExpr, binop: 9, prefix: prefix, startsExpr: startsExpr
  }),
  modulo: new BinopTokenType('%', 10),
  star: new BinopTokenType('*', 10),
  slash: new BinopTokenType('/', 10),
  power: new TokenType('^', {
    beforeExpr: beforeExpr,
    binop: 11,
    rightAssociative: true
  }),
  exponent: new TokenType('**', {
    beforeExpr: beforeExpr,
    binop: 11,
    rightAssociative: true
  })
};

var keywords = {
  break: new KeywordTokenType('break'),
  case: new KeywordTokenType('case', { beforeExpr: beforeExpr }),
  catch: new KeywordTokenType('catch'),
  continue: new KeywordTokenType('continue'),
  debugger: new KeywordTokenType('debugger'),
  default: new KeywordTokenType('default', { beforeExpr: beforeExpr }),
  do: new KeywordTokenType('do', { isLoop: isLoop, beforeExpr: beforeExpr }),
  else: new KeywordTokenType('else', { beforeExpr: beforeExpr }),
  finally: new KeywordTokenType('finally'),
  for: new KeywordTokenType('for', { isLoop: isLoop }),
  function: new KeywordTokenType('function', { startsExpr: startsExpr }),
  if: new KeywordTokenType('if'),
  return: new KeywordTokenType('return', { beforeExpr: beforeExpr }),
  'switch': new KeywordTokenType('switch'), // eslint-disable-line
  throw: new KeywordTokenType('throw', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  try: new KeywordTokenType('try'),
  var: new KeywordTokenType('var'),
  let: new KeywordTokenType('let'),
  const: new KeywordTokenType('const'),
  while: new KeywordTokenType('while', { isLoop: isLoop }),
  with: new KeywordTokenType('with'),
  new: new KeywordTokenType('new', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  this: new KeywordTokenType('this', { startsExpr: startsExpr }),
  super: new KeywordTokenType('super', { startsExpr: startsExpr }),
  class: new KeywordTokenType('class'),
  extends: new KeywordTokenType('extends', { beforeExpr: beforeExpr }),
  export: new KeywordTokenType('export'),
  import: new KeywordTokenType('import', { startsExpr: startsExpr }),
  yield: new KeywordTokenType('yield', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  null: new KeywordTokenType('null', { startsExpr: startsExpr }),
  true: new KeywordTokenType('true', { startsExpr: startsExpr }),
  false: new KeywordTokenType('false', { startsExpr: startsExpr }),
  in: new KeywordTokenType('in', { beforeExpr: beforeExpr, binop: 7 }),
  instanceof: new KeywordTokenType('instanceof', { beforeExpr: beforeExpr, binop: 7 }),
  typeof: new KeywordTokenType('typeof', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  void: new KeywordTokenType('void', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  delete: new KeywordTokenType('delete', { beforeExpr: beforeExpr, prefix: prefix, startsExpr: startsExpr }),
  async: new KeywordTokenType('async'),
  await: new KeywordTokenType('await', { beforeExpr: beforeExpr, startsExpr: startsExpr }),
  cond: new KeywordTokenType('cond', { startsExpr: startsExpr })
};

// Map keyword names to token types.
Object.keys(keywords).forEach(function (name) {
  types['_' + name] = keywords[name];
});

/* eslint max-len: 0 */

function makePredicate(words) {
  var wordsArr = words.split(' ');
  return function (str) {
    return wordsArr.indexOf(str) >= 0;
  };
}

// And the keywords

var isKeyword = makePredicate('break case catch continue debugger default do else finally for function if return switch throw try var while null true false instanceof typeof void delete new in this let const class extends export import yield super async await cond');

// ## Character categories

// Big ugly regular expressions that match characters in the
// whitespace, identifier, and identifier-start categories. These
// are only applied when a character is found to actually have a
// code point above 128.
// Generated by `scripts/generate-identifier-regex.js`.

/* prettier-ignore */
var nonASCIIidentifierStartChars = '\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC';
/* prettier-ignore */
var nonASCIIidentifierChars = '\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D4-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA900-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F';

var nonASCIIidentifierStart = new RegExp('[' + nonASCIIidentifierStartChars + ']');
var nonASCIIidentifier = new RegExp('[' + nonASCIIidentifierStartChars + nonASCIIidentifierChars + ']');

nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;

// These are a run-length and offset encoded representation of the
// >0xffff code points that are a valid part of identifiers. The
// offset starts at 0x10000, and each pair of numbers represents an
// offset to the next range, and then a size of the range. They were
// generated by `bin/generate-identifier-regex.js`.
/* prettier-ignore */
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 26, 45, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 785, 52, 76, 44, 33, 24, 27, 35, 42, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 54, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 86, 25, 391, 63, 32, 0, 257, 0, 11, 39, 8, 0, 22, 0, 12, 39, 3, 3, 55, 56, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 698, 921, 103, 110, 18, 195, 2749, 1070, 4050, 582, 8634, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 881, 68, 12, 0, 67, 12, 65, 1, 31, 6124, 20, 754, 9486, 286, 82, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 60, 67, 1213, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 3, 5761, 15, 7472, 3104, 541];
/* prettier-ignore */
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 1306, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 52, 0, 13, 2, 49, 13, 10, 2, 4, 9, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 57, 0, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 87, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 423, 9, 280, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 19719, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 2214, 6, 110, 6, 6, 9, 792487, 239];

// This has a complexity linear to the value of the code. The
// assumption is that looking up astral identifier characters is
// rare.
function isInAstralSet(code, set) {
  var pos = 0x10000;
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) return false;

    pos += set[i + 1];
    if (pos >= code) return true;
  }
  return false;
}

// Test whether a given character code starts an identifier.

function isIdentifierStart(code) {
  if (code < 65) return code === 36;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }
  return isInAstralSet(code, astralIdentifierStartCodes);
}

// Test whether a given character is part of an identifier.

function isIdentifierChar(code) {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  }
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}

// @flow

const backSpace = 8;
const lineFeed = 10; //  '\n'
const carriageReturn = 13; //  '\r'
const shiftOut = 14;
const space = 32;
const exclamationMark = 33; //  '!'
const quotationMark = 34; //  '"'
const numberSign = 35; //  '#'
const dollarSign = 36; //  '$'
const percentSign = 37; //  '%'
const ampersand = 38; //  '&'
const apostrophe = 39; //  '''
const leftParenthesis = 40; //  '('
const rightParenthesis = 41; //  ')'
const asterisk = 42; //  '*'
const plusSign = 43; //  '+'
const comma = 44; //  ','
const dash = 45; //  '-'
const dot = 46; //  '.'
const slash = 47; //  '/'
const digit0 = 48; //  '0'
const digit1 = 49; //  '1'
const digit2 = 50; //  '2'
const digit3 = 51; //  '3'
const digit4 = 52; //  '4'
const digit5 = 53; //  '5'
const digit6 = 54; //  '6'
const digit7 = 55; //  '7'
const digit8 = 56; //  '8'
const digit9 = 57; //  '9'
const colon = 58; //  ':'
const semicolon = 59; //  ';'
const lessThan = 60; //  '<'
const equalsTo = 61; //  '='
const greaterThan = 62; //  '>'
const questionMark = 63; //  '?'
const atSign = 64; //  '@'
const uppercaseA = 65; //  'A'
const uppercaseB = 66; //  'B'
const uppercaseC = 67; //  'C'
const uppercaseD = 68; //  'D'
const uppercaseE = 69; //  'E'
const uppercaseF = 70; //  'F'
const uppercaseO = 79; //  'O'
const uppercaseX = 88; //  'X'
const leftSquareBracket = 91; //  '['
const backslash = 92; //  '\    '
const rightSquareBracket = 93; //  ']'
const caret = 94; //  '^'
const graveAccent = 96; //  '`'
const lowercaseA = 97; //  'a'
const lowercaseB = 98; //  'b'
const lowercaseC = 99; //  'c'
const lowercaseD = 100; //  'd'
const lowercaseE = 101; //  'e'
const lowercaseF = 102; //  'f'
const lowercaseN = 110; //  'n'
const lowercaseO = 111; //  'o'
const lowercaseR = 114; //  'r'
const lowercaseT = 116; //  't'
const lowercaseU = 117; //  'u'
const lowercaseV = 118; //  'v'
const lowercaseX = 120; //  'x'
const leftCurlyBrace = 123; //  '{'
const verticalBar = 124; //  '|'
const rightCurlyBrace = 125; //  '}'
const tilde = 126; //  '~'
const nonBreakingSpace = 160;
const oghamSpaceMark = 5760; // ' '
const lineSeparator = 8232;
const paragraphSeparator = 8233;

function isDigit(code) {
  return code >= digit0 && code <= digit9;
}

// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, 'g');

function isNewLine(code) {
  return code === 10 || code === 13 || code === 0x2028 || code === 0x2029;
}

var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

// The algorithm used to determine whether a regexp can appear at a

var TokContext = function TokContext(token, isExpr, preserveSpace, override) // Takes a Tokenizer as a this-parameter, and returns void.
{
  classCallCheck(this, TokContext);

  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
}

// token: string;
// isExpr: boolean;
// preserveSpace: boolean;
// override: ?Function;
;

var types$1 = {
  braceStatement: new TokContext('{', false),
  braceExpression: new TokContext('{', true),
  templateQuasi: new TokContext('${', true),
  parenStatement: new TokContext('(', false),
  parenExpression: new TokContext('(', true),
  template: new TokContext('`', true, true, function (p) {
    return p.readTmplToken();
  }),
  functionExpression: new TokContext('function', true)
};

// Token-specific context update code

types.parenR.updateContext = types.braceR.updateContext = function update() {
  if (this.state.context.length === 1) {
    this.state.exprAllowed = true;
    return;
  }

  var out = this.state.context.pop();
  if (out === types$1.braceStatement && this.curContext() === types$1.functionExpression) {
    this.state.context.pop();
    this.state.exprAllowed = false;
  } else if (out === types$1.templateQuasi) {
    this.state.exprAllowed = true;
  } else {
    this.state.exprAllowed = !out.isExpr;
  }
};

types.name.updateContext = function update(prevType) {
  if (this.state.value === 'of' && this.curContext() === types$1.parenStatement) {
    this.state.exprAllowed = !prevType.beforeExpr;
    return;
  }

  this.state.exprAllowed = false;

  if (prevType === types._let || prevType === types._const || prevType === types._var) {
    if (lineBreak.test(this.input.slice(this.state.end))) {
      this.state.exprAllowed = true;
    }
  }
  if (this.state.isIterator) {
    this.state.isIterator = false;
  }
};

types.braceL.updateContext = function update(prevType) {
  this.state.context.push(this.braceIsBlock(prevType) ? types$1.braceStatement : types$1.braceExpression);
  this.state.exprAllowed = true;
};

types.dollarBraceL.updateContext = function update() {
  this.state.context.push(types$1.templateQuasi);
  this.state.exprAllowed = true;
};

types.parenL.updateContext = function update(prevType) {
  var statementParens = prevType === types._if || prevType === types._for || prevType === types._with || prevType === types._while;
  this.state.context.push(statementParens ? types$1.parenStatement : types$1.parenExpression);
  this.state.exprAllowed = true;
};

types.incDec.updateContext = function noop() {
  // tokExprAllowed stays unchanged
};

types._function.updateContext = function update(prevType) {
  if (this.state.exprAllowed && !this.braceIsBlock(prevType)) {
    this.state.context.push(types$1.functionExpression);
  }

  this.state.exprAllowed = false;
};

types.backQuote.updateContext = function update() {
  if (this.curContext() === types$1.template) {
    this.state.context.pop();
  } else {
    this.state.context.push(types$1.template);
  }
  this.state.exprAllowed = false;
};

// These are used when `options.locations` is on, for the
// `startLoc` and `endLoc` properties.

var Position =
// line: number;
// column: number;

function Position(line, col) {
  classCallCheck(this, Position);

  this.line = line;
  this.column = col;
};

var SourceLocation =
// start: Position;
// end: Position;
// filename: string;
// identifierName: ?string;

function SourceLocation(start, end) {
  classCallCheck(this, SourceLocation);

  this.start = start;
  // $FlowIgnore (may start as null, but initialized later)
  this.end = end;
};

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

function getLineInfo(input, offset) {
  for (var line = 1, cur = 0;;) {
    lineBreakG.lastIndex = cur;
    var match = lineBreakG.exec(input);
    if (match && match.index < offset) {
      ++line;
      cur = match.index + match[0].length;
    } else {
      return new Position(line, offset - cur);
    }
  }
  // istanbul ignore next
  // throw new Error('Unreachable');
}

var BaseParser = function BaseParser() {
  classCallCheck(this, BaseParser);
};

// @flow

function last(stack) {
  return stack[stack.length - 1];
}

var CommentsParser = function (_BaseParser) {
  inherits(CommentsParser, _BaseParser);

  function CommentsParser() {
    classCallCheck(this, CommentsParser);
    return possibleConstructorReturn(this, (CommentsParser.__proto__ || Object.getPrototypeOf(CommentsParser)).apply(this, arguments));
  }

  createClass(CommentsParser, [{
    key: 'addComment',
    value: function addComment(comment) {
      if (this.filename) comment.loc.filename = this.filename;
      this.state.trailingComments.push(comment);
      this.state.leadingComments.push(comment);
    }
  }, {
    key: 'processComment',
    value: function processComment(node) {
      if (node.type === 'Program' && node.body.length > 0) return;

      var stack = this.state.commentStack;

      var firstChild = void 0;
      var lastChild = void 0;
      var trailComms = void 0;
      var i = void 0;
      var j = void 0;

      if (this.state.trailingComments.length > 0) {
        // If the first comment in trailingComments comes after the
        // current node, then we're good - all comments in the array will
        // come after the node and so it's safe to add them as official
        // trailingComments.
        if (this.state.trailingComments[0].start >= node.end) {
          trailComms = this.state.trailingComments;
          this.state.trailingComments = [];
        } else {
          // Otherwise, if the first comment doesn't come after the
          // current node, that means we have a mix of leading and trailing
          // comments in the array and that leadingComments contains the
          // same items as trailingComments. Reset trailingComments to
          // zero items and we'll handle this by evaluating leadingComments
          // later.
          this.state.trailingComments.length = 0;
        }
      } else if (stack.length > 0) {
        var lastInStack = last(stack);
        if (lastInStack.trailingComments && lastInStack.trailingComments[0].start >= node.end) {
          trailComms = lastInStack.trailingComments;
          delete lastInStack.trailingComments;
        }
      }

      // Eating the stack.
      if (stack.length > 0 && last(stack).start >= node.start) {
        firstChild = stack.pop();
      }

      while (stack.length > 0 && last(stack).start >= node.start) {
        lastChild = stack.pop();
      }

      if (!lastChild && firstChild) lastChild = firstChild;

      // Attach comments that follow a trailing comma on the last
      // property in an object literal or a trailing comma in function arguments
      // as trailing comments
      if (firstChild && this.state.leadingComments.length > 0) {
        var lastComment = last(this.state.leadingComments);

        if (firstChild.type === 'ObjectProperty') {
          if (lastComment.start >= node.start) {
            if (this.state.commentPreviousNode) {
              for (j = 0; j < this.state.leadingComments.length; j++) {
                if (this.state.leadingComments[j].end < this.state.commentPreviousNode.end) {
                  this.state.leadingComments.splice(j, 1);
                  j--;
                }
              }

              if (this.state.leadingComments.length > 0) {
                firstChild.trailingComments = this.state.leadingComments;
                this.state.leadingComments = [];
              }
            }
          }
        } else if (node.type === 'CallExpression' && node.arguments && node.arguments.length) {
          var lastArg = last(node.arguments);

          if (lastArg && lastComment.start >= lastArg.start && lastComment.end <= node.end) {
            if (this.state.commentPreviousNode) {
              if (this.state.leadingComments.length > 0) {
                lastArg.trailingComments = this.state.leadingComments;
                this.state.leadingComments = [];
              }
            }
          }
        }
      }

      if (lastChild) {
        if (lastChild.leadingComments) {
          if (lastChild !== node && lastChild.leadingComments.length > 0 && last(lastChild.leadingComments).end <= node.start) {
            node.leadingComments = lastChild.leadingComments;
            delete lastChild.leadingComments;
          } else {
            // A leading comment for an anonymous class had been stolen by its first ClassMethod,
            // so this takes back the leading comment.
            // See also: https://github.com/eslint/espree/issues/158
            for (i = lastChild.leadingComments.length - 2; i >= 0; --i) {
              if (lastChild.leadingComments[i].end <= node.start) {
                node.leadingComments = lastChild.leadingComments.splice(0, i + 1);
                break;
              }
            }
          }
        }
      } else if (this.state.leadingComments.length > 0) {
        if (last(this.state.leadingComments).end <= node.start) {
          if (this.state.commentPreviousNode) {
            for (j = 0; j < this.state.leadingComments.length; j++) {
              if (this.state.leadingComments[j].end < this.state.commentPreviousNode.end) {
                this.state.leadingComments.splice(j, 1);
                j--;
              }
            }
          }
          if (this.state.leadingComments.length > 0) {
            node.leadingComments = this.state.leadingComments;
            this.state.leadingComments = [];
          }
        } else {
          // https://github.com/eslint/espree/issues/2
          //
          // In special cases, such as return (without a value) and
          // debugger, all comments will end up as leadingComments and
          // will otherwise be eliminated. This step runs when the
          // commentStack is empty and there are comments left
          // in leadingComments.
          //
          // This loop figures out the stopping point between the actual
          // leading and trailing comments by finding the location of the
          // first comment that comes after the given node.
          for (i = 0; i < this.state.leadingComments.length; i++) {
            if (this.state.leadingComments[i].end > node.start) {
              break;
            }
          }

          // Split the array based on the location of the first comment
          // that comes after the node. Keep in mind that this could
          // result in an empty array, and if so, the array must be
          // deleted.
          var leadingComments = this.state.leadingComments.slice(0, i);

          if (leadingComments.length) {
            node.leadingComments = leadingComments;
          }

          // Similarly, trailing comments are attached later. The variable
          // must be reset to null if there are no trailing comments.
          trailComms = this.state.leadingComments.slice(i);
          if (trailComms.length === 0) {
            trailComms = null;
          }
        }
      }

      this.state.commentPreviousNode = node;

      if (trailComms) {
        if (trailComms.length && trailComms[0].start >= node.start && last(trailComms).end <= node.end) {
          node.innerComments = trailComms;
        } else {
          node.trailingComments = trailComms;
        }
      }

      stack.push(node);
    }
  }]);
  return CommentsParser;
}(BaseParser);

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

var LocationParser = function (_CommentsParser) {
  inherits(LocationParser, _CommentsParser);

  function LocationParser() {
    classCallCheck(this, LocationParser);
    return possibleConstructorReturn(this, (LocationParser.__proto__ || Object.getPrototypeOf(LocationParser)).apply(this, arguments));
  }

  createClass(LocationParser, [{
    key: 'raise',
    value: function raise(pos, message) {
      var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          code = _ref.code;

      var loc = getLineInfo(this.input, pos);
      message += ' at \'' + this.input[pos] + '\' (' + loc.line + ':' + loc.column + ')';
      // $FlowIgnore
      var err = new SyntaxError(message);
      err.pos = pos;
      err.loc = loc;
      if (code !== undefined) {
        err.code = code;
      }
      console.error(err.stack);
      throw err;
    }
  }]);
  return LocationParser;
}(CommentsParser);

var State = function () {
  function State() {
    classCallCheck(this, State);
  }

  createClass(State, [{
    key: 'init',
    value: function init(options, input) {
      this.strict = options.strictMode === false ? false : options.sourceType === 'module';

      this.input = input;

      this.potentialArrowAt = -1;

      this.noArrowAt = [];
      this.noArrowParamsConversionAt = [];
      this.noPipe = false;

      this.inMethod = false;
      this.inFunction = false;
      this.inParameters = false;
      this.maybeInArrowParameters = false;
      this.inGenerator = false;
      this.inAsync = false;
      this.inPropertyName = false;
      this.inType = false;
      this.inClassProperty = false;
      this.noAnonFunctionType = false;
      this.hasFlowComment = false;
      this.isIterator = false;

      this.classLevel = 0;

      this.labels = [];

      this.decoratorStack = [[]];

      this.yieldInPossibleArrowParameters = null;

      this.tokens = [];

      this.comments = [];

      this.trailingComments = [];
      this.leadingComments = [];
      this.commentStack = [];
      // $FlowIgnore
      this.commentPreviousNode = null;

      this.pos = this.lineStart = 0;
      this.curLine = options.startLine;

      this.type = types.eof;
      this.value = null;
      this.start = this.end = this.pos;
      this.startLoc = this.endLoc = this.curPosition();

      // $FlowIgnore
      this.lastTokEndLoc = this.lastTokStartLoc = null;
      this.lastTokStart = this.lastTokEnd = this.pos;

      this.context = [types$1.braceStatement];
      this.exprAllowed = true;

      this.containsEsc = this.containsOctal = false;
      this.octalPosition = null;

      this.invalidTemplateEscapePosition = null;

      this.exportedIdentifiers = [];
    }

    // TODO
    // strict: boolean;

    // TODO
    // input: string;

    // Used to signify the start of a potential arrow function
    // potentialArrowAt: number;

    // Used to signify the start of an expression which looks like a
    // typed arrow function, but it isn't
    // e.g. a ? (b) : c => d
    //          ^
    // noArrowAt: number[];

    // Used to signify the start of an expression whose params, if it looks like
    // an arrow function, shouldn't be converted to assignable nodes.
    // This is used to defer the validation of typed arrow functions inside
    // conditional expressions.
    // e.g. a ? (b) : c => d
    //          ^
    // noArrowParamsConversionAt: number[];

    // Flags to track whether we are in a function, a generator.
    // inFunction: boolean;
    // inParameters: boolean;
    // maybeInArrowParameters: boolean;
    // inGenerator: boolean;
    // inMethod: boolean | N.MethodKind;
    // inAsync: boolean;
    // inType: boolean;
    // noAnonFunctionType: boolean;
    // inPropertyName: boolean;
    // inClassProperty: boolean;
    // hasFlowComment: boolean;
    // isIterator: boolean;

    // Check whether we are in a (nested) class or not.
    // classLevel: number;

    // Labels in scope.
    // labels: Array<{ kind: ?("loop" | "switch"), statementStart?: number }>;

    // Leading decorators. Last element of the stack represents the decorators in current context.
    // Supports nesting of decorators, e.g. @foo(@bar class inner {}) class outer {}
    // where @foo belongs to the outer class and @bar to the inner
    // decoratorStack: Array<Array<N.Decorator>>;

    // The first yield expression inside parenthesized expressions and arrow
    // function parameters. It is used to disallow yield in arrow function
    // parameters.
    // yieldInPossibleArrowParameters: ?N.YieldExpression;

    // Token store.
    // tokens: Array<Token | N.Comment>;

    // Comment store.
    // comments: Array<N.Comment>;

    // Comment attachment store
    // trailingComments: Array<N.Comment>;
    // leadingComments: Array<N.Comment>;
    // commentStack: Array<{
    // start: number,
    // leadingComments: ?Array<N.Comment>,
    // trailingComments: ?Array<N.Comment>,
    // }>;
    // commentPreviousNode: N.Node;

    // The current position of the tokenizer in the input.
    // pos: number;
    // lineStart: number;
    // curLine: number;

    // Properties of the current token:
    // Its type
    // type: TokenType;

    // For tokens that include more information than their type, the value
    // value: any;

    // Its start and end offset
    // start: number;
    // end: number;

    // And, if locations are used, the {line, column} object
    // corresponding to those offsets
    // startLoc: Position;
    // endLoc: Position;

    // Position information for the previous token
    // lastTokEndLoc: Position;
    // lastTokStartLoc: Position;
    // lastTokStart: number;
    // lastTokEnd: number;

    // The context stack is used to superficially track syntactic
    // context to predict whether a regular expression is allowed in a
    // given position.
    // context: Array<TokContext>;
    // exprAllowed: boolean;

    // Used to signal to callers of `readWord1` whether the word
    // contained any escape sequences. This is needed because words with
    // escape sequences must not be interpreted as keywords.
    // containsEsc: boolean;

    // TODO
    // containsOctal: boolean;
    // octalPosition: ?number;

    // Names of exports store. `default` is stored as a name for both
    // `export default foo;` and `export { foo as default };`.
    // exportedIdentifiers: Array<string>;

    // invalidTemplateEscapePosition: ?number;

  }, {
    key: 'curPosition',
    value: function curPosition() {
      return new Position(this.curLine, this.pos - this.lineStart);
    }
  }, {
    key: 'clone',
    value: function clone(skipArrays) {
      var _this = this;

      var state = new State();
      Object.keys(this).forEach(function (key) {
        var val = _this[key];

        if ((!skipArrays || key === 'context') && Array.isArray(val)) {
          val = val.slice();
        }

        state[key] = val;
      });
      return state;
    }
  }]);
  return State;
}();

var VALID_REGEX_FLAGS = 'gmsiyu';

// The following character codes are forbidden from being
// an immediate sibling of NumericLiteralSeparator _

/* const forbiddenNumericSeparatorSiblings = {
  decBinOct: [
    charCodes.dot,
    charCodes.uppercaseB,
    charCodes.uppercaseE,
    charCodes.uppercaseO,
    charCodes.underscore, // multiple separators are not allowed
    charCodes.lowercaseB,
    charCodes.lowercaseE,
    charCodes.lowercaseO
  ],
  hex: [
    charCodes.dot,
    charCodes.uppercaseX,
    charCodes.underscore, // multiple separators are not allowed
    charCodes.lowercaseX
  ]
}; */

var allowedNumericSeparatorSiblings = {};
allowedNumericSeparatorSiblings.bin = [
// 0 - 1
digit0, digit1];
allowedNumericSeparatorSiblings.oct = [].concat(toConsumableArray(allowedNumericSeparatorSiblings.bin), [digit2, digit3, digit4, digit5, digit6, digit7]);
allowedNumericSeparatorSiblings.dec = [].concat(toConsumableArray(allowedNumericSeparatorSiblings.oct), [digit8, digit9]);

allowedNumericSeparatorSiblings.hex = [].concat(toConsumableArray(allowedNumericSeparatorSiblings.dec), [uppercaseA, uppercaseB, uppercaseC, uppercaseD, uppercaseE, uppercaseF, lowercaseA, lowercaseB, lowercaseC, lowercaseD, lowercaseE, lowercaseF]);

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

var Token = function Token(state) {
  classCallCheck(this, Token);

  this.type = state.type;
  this.value = state.value;
  this.start = state.start;
  this.end = state.end;
  this.loc = new SourceLocation(state.startLoc, state.endLoc);
}

// type: TokenType;
// value: any;
// start: number;
// end: number;
// loc: SourceLocation;
;

// ## Tokenizer

function codePointToString(code) {
  // UTF-16 Decoding
  if (code <= 0xffff) {
    return String.fromCharCode(code);
  }
  return String.fromCharCode((code - 0x10000 >> 10) + 0xd800, // eslint-disable-line no-bitwise
  (code - 0x10000 & 1023) + 0xdc00 // eslint-disable-line no-bitwise
  );
}

var Tokenizer = function (_LocationParser) {
  inherits(Tokenizer, _LocationParser);

  // isLookahead: boolean;

  function Tokenizer(options, input) {
    classCallCheck(this, Tokenizer);

    var _this = possibleConstructorReturn(this, (Tokenizer.__proto__ || Object.getPrototypeOf(Tokenizer)).call(this));

    _this.state = new State();
    _this.state.init(options, input);
    _this.isLookahead = false;
    return _this;
  }

  // Move to the next token

  createClass(Tokenizer, [{
    key: 'next',
    value: function next() {
      if (!this.isLookahead) {
        this.state.tokens.push(new Token(this.state));
      }

      this.state.lastTokEnd = this.state.end;
      this.state.lastTokStart = this.state.start;
      this.state.lastTokEndLoc = this.state.endLoc;
      this.state.lastTokStartLoc = this.state.startLoc;
      this.nextToken();
    }
  }, {
    key: 'prevToken',
    value: function prevToken() {
      return this.state.tokens[this.state.tokens.length - 1];
    }
  }, {
    key: 'matchPrev',
    value: function matchPrev(type) {
      return this.prevToken().type === type;
    }

    // TODO

  }, {
    key: 'eat',
    value: function eat(type) {
      if (this.match(type)) {
        this.next();
        return true;
      }
      return false;
    }

    // TODO

  }, {
    key: 'match',
    value: function match(type) {
      return this.state.type === type;
    }

    // TODO

  }, {
    key: 'lookahead',
    value: function lookahead() {
      var old = this.state;
      this.state = old.clone(true);

      this.isLookahead = true;
      this.next();
      this.isLookahead = false;

      var curr = this.state;
      this.state = old;
      return curr;
    }

    // Toggle strict mode. Re-reads the next number or string to please
    // pedantic tests (`"use strict"; 010;` should fail).

  }, {
    key: 'setStrict',
    value: function setStrict(strict) {
      this.state.strict = strict;
      if (!this.match(types.num) && !this.match(types.string)) return;
      this.state.pos = this.state.start;
      while (this.state.pos < this.state.lineStart) {
        this.state.lineStart = this.input.lastIndexOf('\n', this.state.lineStart - 2) + 1;
        --this.state.curLine;
      }
      this.nextToken();
    }
  }, {
    key: 'curContext',
    value: function curContext() {
      return this.state.context[this.state.context.length - 1];
    }

    // Read a single token, updating the parser object's token-related
    // properties.

  }, {
    key: 'nextToken',
    value: function nextToken() {
      var curContext = this.curContext();
      if (!curContext || !curContext.preserveSpace) this.skipSpace();

      this.state.containsOctal = false;
      this.state.octalPosition = null;
      this.state.start = this.state.pos;
      this.state.startLoc = this.state.curPosition();
      if (this.state.pos >= this.input.length) {
        this.finishToken(types.eof);
        return;
      }

      if (curContext.override) {
        curContext.override(this);
      } else {
        this.readToken(this.fullCharCodeAtPos());
      }
    }
  }, {
    key: 'readToken',
    value: function readToken(code) {
      // Identifier or keyword. '\uXXXX' sequences are allowed in
      // identifiers, so '\' also dispatches to that.
      if (isIdentifierStart(code) || code === backslash) {
        this.readWord();
      } else {
        this.getTokenFromCode(code);
      }
    }
  }, {
    key: 'fullCharCodeAtPos',
    value: function fullCharCodeAtPos() {
      var code = this.input.charCodeAt(this.state.pos);
      if (code <= 0xd7ff || code >= 0xe000) return code;

      var next = this.input.charCodeAt(this.state.pos + 1);
      return (code << 10) + next - 0x35fdc00; // eslint-disable-line no-bitwise
    }
  }, {
    key: 'pushComment',
    value: function pushComment(block, text, start, end, startLoc, endLoc) {
      var comment = {
        type: block ? 'CommentBlock' : 'CommentLine',
        value: text,
        start: start,
        end: end,
        loc: new SourceLocation(startLoc, endLoc)
      };

      if (!this.isLookahead) {
        if (this.options.tokens) this.state.tokens.push(comment);
        this.state.comments.push(comment);
        this.addComment(comment);
      }
    }
  }, {
    key: 'skipBlockComment',
    value: function skipBlockComment() {
      var startLoc = this.state.curPosition();
      var start = this.state.pos;
      var end = this.input.indexOf('*/', this.state.pos += 2);
      if (end === -1) this.raise(this.state.pos - 2, 'Unterminated comment');

      this.state.pos = end + 2;
      lineBreakG.lastIndex = start;
      var match = lineBreakG.exec(this.input);
      while (match && match.index < this.state.pos) {
        ++this.state.curLine;
        this.state.lineStart = match.index + match[0].length;
        match = lineBreakG.exec(this.input);
      }

      this.pushComment(true, this.input.slice(start + 2, end), start, this.state.pos, startLoc, this.state.curPosition());
    }
  }, {
    key: 'skipLineComment',
    value: function skipLineComment(startSkip) {
      var start = this.state.pos;
      var startLoc = this.state.curPosition();
      var ch = this.input.charCodeAt(this.state.pos += startSkip);
      if (this.state.pos < this.input.length) {
        while (ch !== lineFeed && ch !== carriageReturn && ch !== lineSeparator && ch !== paragraphSeparator && ++this.state.pos < this.input.length) {
          ch = this.input.charCodeAt(this.state.pos);
        }
      }

      this.pushComment(false, this.input.slice(start + startSkip, this.state.pos), start, this.state.pos, startLoc, this.state.curPosition());
    }

    // Called at the start of the parse and after every token. Skips
    // whitespace and comments, and.

  }, {
    key: 'skipSpace',
    value: function skipSpace() {
      // TODO: Rework this to not use a label
      loop: while (this.state.pos < this.input.length) {
        // eslint-disable-line no-labels
        var ch = this.input.charCodeAt(this.state.pos);
        switch (ch) {
          case space:
          case nonBreakingSpace:
            ++this.state.pos;
            break;

          case carriageReturn:
            if (this.input.charCodeAt(this.state.pos + 1) === lineFeed) {
              ++this.state.pos;
            }

          case lineFeed:
          case lineSeparator:
          case paragraphSeparator:
            ++this.state.pos;
            ++this.state.curLine;
            this.state.lineStart = this.state.pos;
            break;

          case slash:
            switch (this.input.charCodeAt(this.state.pos + 1)) {
              case asterisk:
                this.skipBlockComment();
                break;

              case slash:
                this.skipLineComment(2);
                break;

              default:
                break loop; // eslint-disable-line no-labels
            }
            break;

          default:
            if (ch > backSpace && ch < shiftOut || ch >= oghamSpaceMark && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
              ++this.state.pos;
            } else {
              break loop; // eslint-disable-line no-labels
            }
        }
      }
    }

    // Called at the end of every token. Sets `end`, `val`, and
    // maintains `context` and `exprAllowed`, and skips the space after
    // the token, so that the next one's `start` will point at the
    // right position.

  }, {
    key: 'finishToken',
    value: function finishToken(type, val) {
      this.state.end = this.state.pos;
      this.state.endLoc = this.state.curPosition();
      var prevType = this.state.type;
      this.state.type = type;
      this.state.value = val;

      this.updateContext(prevType);
    }

    // ### Token reading

    // This is the function that is called to fetch the next token. It
    // is somewhat obscure, because it works in character codes rather
    // than characters, and because operator parsing has been inlined
    // into it.
    //
    // All in the name of speed.
    //

  }, {
    key: 'readTokenDot',
    value: function readTokenDot() {
      var next = this.input.charCodeAt(this.state.pos + 1);
      if (next >= digit0 && next <= digit9) {
        this.readNumber(true);
        return;
      }

      var next2 = this.input.charCodeAt(this.state.pos + 2);
      if (next === dot && next2 === dot) {
        this.state.pos += 3;
        this.finishToken(types.ellipsis);
      } else {
        ++this.state.pos;
        this.finishToken(types.dot);
      }
    }
  }, {
    key: 'readTokenSlash',
    value: function readTokenSlash() {
      // '/'
      if (this.state.exprAllowed) {
        ++this.state.pos;
        this.readRegexp();
        return;
      }

      var next = this.input.charCodeAt(this.state.pos + 1);
      if (next === equalsTo) {
        this.finishOp(types.assign, 2);
      } else {
        this.finishOp(types.slash, 1);
      }
    }
  }, {
    key: 'readTokenMultModulo',
    value: function readTokenMultModulo(code) {
      // '%*'
      var type = code === asterisk ? types.star : types.modulo;
      var width = 1;
      var next = this.input.charCodeAt(this.state.pos + 1);
      var exprAllowed = this.state.exprAllowed;

      // Exponentiation operator **

      if (code === asterisk && next === asterisk) {
        width++;
        next = this.input.charCodeAt(this.state.pos + 2);
        type = types.exponent;
      }

      if (next === equalsTo && !exprAllowed) {
        width++;
        type = types.assign;
      }

      this.finishOp(type, width);
    }
  }, {
    key: 'readTokenPipeAmp',
    value: function readTokenPipeAmp(code) {
      // '|&'
      var next = this.input.charCodeAt(this.state.pos + 1);

      if (next === code) {
        if (this.input.charCodeAt(this.state.pos + 2) === equalsTo) {
          this.finishOp(types.assign, 3);
        } else {
          this.finishOp(code === verticalBar ? types.logicalOR : types.logicalAND, 2);
        }
        return;
      }

      if (code === verticalBar) {
        // '|>'
        if (next === greaterThan) {
          this.finishOp(types.pipeline, 2);
          return;
        }
      }

      if (next === equalsTo) {
        this.finishOp(types.assign, 2);
        return;
      }

      this.finishOp(code === verticalBar ? types.bitwiseOR : types.bitwiseAND, 1);
    }
  }, {
    key: 'readTokenCaret',
    value: function readTokenCaret() {
      // '^'
      var next = this.input.charCodeAt(this.state.pos + 1);
      if (next === equalsTo) {
        this.finishOp(types.assign, 2);
      } else {
        this.finishOp(types.power, 1);
      }
    }
  }, {
    key: 'readTokenPlusMin',
    value: function readTokenPlusMin(code) {
      // '+-'
      var next = this.input.charCodeAt(this.state.pos + 1);

      if (next === code) {
        if (next === dash && !this.inModule && this.input.charCodeAt(this.state.pos + 2) === greaterThan && lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.pos))) {
          // A `-->` line comment
          this.skipLineComment(3);
          this.skipSpace();
          this.nextToken();
          return;
        }
        this.finishOp(types.incDec, 2);
        return;
      }

      if (code === dash && next === greaterThan) {
        this.state.pos += 2;
        this.finishToken(types.arrowThin);
        return;
      }

      if (next === equalsTo) {
        this.finishOp(types.assign, 2);
      } else {
        this.finishOp(types.plusMin, 1);
      }
    }
  }, {
    key: 'readTokenLTGT',
    value: function readTokenLTGT(code) {
      // '<>'
      var next = this.input.charCodeAt(this.state.pos + 1);
      var size = 1;

      if (next === code) {
        size = code === greaterThan && this.input.charCodeAt(this.state.pos + 2) === greaterThan ? 3 : 2;
        if (this.input.charCodeAt(this.state.pos + size) === equalsTo) {
          this.finishOp(types.assign, size + 1);
          return;
        }
        this.finishOp(types.bitShift, size);
        return;
      }

      if (next === exclamationMark && code === lessThan && !this.inModule && this.input.charCodeAt(this.state.pos + 2) === dash && this.input.charCodeAt(this.state.pos + 3) === dash) {
        // `<!--`, an XML-style comment that should be interpreted as a line comment
        this.skipLineComment(4);
        this.skipSpace();
        this.nextToken();
        return;
      }

      if (next === equalsTo) {
        // <= | >=
        size = 2;
      }

      this.finishOp(types.relational, size);
    }
  }, {
    key: 'readTokenEqExcl',
    value: function readTokenEqExcl(code) {
      // '=!'
      var next = this.input.charCodeAt(this.state.pos + 1);
      if (next === equalsTo) {
        this.finishOp(types.equality, this.input.charCodeAt(this.state.pos + 2) === equalsTo ? 3 : 2);
        return;
      }
      if (code === equalsTo && next === greaterThan) {
        // '=>'
        this.state.pos += 2;
        this.finishToken(types.arrow);
        return;
      }
      this.finishOp(code === equalsTo ? types.eq : types.bang, 1);
    }
  }, {
    key: 'readTokenQuestion',
    value: function readTokenQuestion() {
      // '?'
      var next = this.input.charCodeAt(this.state.pos + 1);
      var next2 = this.input.charCodeAt(this.state.pos + 2);
      if (next === questionMark) {
        if (next2 === equalsTo) {
          // '??='
          this.finishOp(types.assign, 3);
        } else {
          // '??'
          this.finishOp(types.nullishCoalescing, 2);
        }
      } else if (next === dot && !(next2 >= digit0 && next2 <= digit9)) {
        // '.' not followed by a number
        this.state.pos += 2;
        this.finishToken(types.questionDot);
      } else {
        ++this.state.pos;
        this.finishToken(types.question);
      }
    }
  }, {
    key: 'getTokenFromCode',
    value: function getTokenFromCode(code) {
      switch (code) {
        case numberSign:
          ++this.state.pos;
          this.finishToken(types.hash);
          return;

        // The interpretation of a dot depends on whether it is followed
        // by a digit or another two dots.

        case dot:
          this.readTokenDot();
          return;

        // Punctuation tokens.
        case leftParenthesis:
          ++this.state.pos;
          this.finishToken(types.parenL);
          return;
        case rightParenthesis:
          ++this.state.pos;
          this.finishToken(types.parenR);
          return;
        case semicolon:
          ++this.state.pos;
          this.finishToken(types.semi);
          return;
        case comma:
          ++this.state.pos;
          this.finishToken(types.comma);
          return;
        case leftSquareBracket:
          ++this.state.pos;
          this.finishToken(types.bracketL);
          return;
        case rightSquareBracket:
          ++this.state.pos;
          this.finishToken(types.bracketR);
          return;

        case leftCurlyBrace:
          ++this.state.pos;
          this.finishToken(types.braceL);
          return;

        case rightCurlyBrace:
          ++this.state.pos;
          this.finishToken(types.braceR);
          return;

        case colon:
          if (this.input.charCodeAt(this.state.pos + 1) === colon) {
            this.finishOp(types.doubleColon, 2);
          } else {
            ++this.state.pos;
            this.finishToken(types.colon);
          }
          return;

        case questionMark:
          this.readTokenQuestion();
          return;
        case atSign:
          ++this.state.pos;
          this.finishToken(types.at);
          return;

        case graveAccent:
          ++this.state.pos;
          this.finishToken(types.backQuote);
          return;

        case digit0:
          {
            var next = this.input.charCodeAt(this.state.pos + 1);
            // '0x', '0X' - hex number
            if (next === lowercaseX || next === uppercaseX) {
              this.readRadixNumber(16);
              return;
            }
            // '0o', '0O' - octal number
            if (next === lowercaseO || next === uppercaseO) {
              this.readRadixNumber(8);
              return;
            }
            // '0b', '0B' - binary number
            if (next === lowercaseB || next === uppercaseB) {
              this.readRadixNumber(2);
              return;
            }
          }
        // Anything else beginning with a digit is an integer, octal
        // number, or float.
        case digit1:
        case digit2:
        case digit3:
        case digit4:
        case digit5:
        case digit6:
        case digit7:
        case digit8:
        case digit9:
          this.readNumber(false);
          return;

        // Quotes produce strings.
        case quotationMark:
        case apostrophe:
          this.readString(code);
          return;

        // Operators are parsed inline in tiny state machines. '=' (charCodes.equalsTo) is
        // often referred to. `finishOp` simply skips the amount of
        // characters it is given as second argument, and returns a token
        // of the type given by its first argument.

        case slash:
          this.readTokenSlash();
          return;

        case percentSign:
        case asterisk:
          this.readTokenMultModulo(code);
          return;

        case verticalBar:
        case ampersand:
          this.readTokenPipeAmp(code);
          return;

        case caret:
          this.readTokenCaret();
          return;

        case plusSign:
        case dash:
          this.readTokenPlusMin(code);
          return;

        case lessThan:
        case greaterThan:
          this.readTokenLTGT(code);
          return;

        case equalsTo:
        case exclamationMark:
          this.readTokenEqExcl(code);
          return;

        case tilde:
          this.finishOp(types.tilde, 1);
          return;

        default:
          this.raise(this.state.pos, 'Unexpected character \'' + codePointToString(code) + '\'');
      }
    }
  }, {
    key: 'finishOp',
    value: function finishOp(type, size) {
      var str = this.input.slice(this.state.pos, this.state.pos + size);
      this.state.pos += size;
      this.finishToken(type, str);
    }
  }, {
    key: 'readRegexp',
    value: function readRegexp() {
      var start = this.state.pos;
      var escaped = void 0;
      var inClass = void 0;
      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(start, 'Unterminated regular expression');
        }
        var ch = this.input.charAt(this.state.pos);
        if (lineBreak.test(ch)) {
          this.raise(start, 'Unterminated regular expression');
        }
        if (escaped) {
          escaped = false;
        } else {
          if (ch === '[') {
            inClass = true;
          } else if (ch === ']' && inClass) {
            inClass = false;
          } else if (ch === '/' && !inClass) {
            break;
          }
          escaped = ch === '\\';
        }
        ++this.state.pos;
      }
      var content = this.input.slice(start, this.state.pos);
      ++this.state.pos;

      var mods = '';

      while (this.state.pos < this.input.length) {
        var char = this.input[this.state.pos];
        var charCode = this.fullCharCodeAtPos();

        if (VALID_REGEX_FLAGS.indexOf(char) > -1) {
          if (mods.indexOf(char) > -1) {
            this.raise(this.state.pos + 1, 'Duplicate regular expression flag');
          }

          ++this.state.pos;
          mods += char;
        } else if (isIdentifierChar(charCode) || charCode === backslash) {
          this.raise(this.state.pos + 1, 'Invalid regular expression flag');
        } else {
          break;
        }
      }

      this.finishToken(types.regexp, {
        pattern: content,
        flags: mods
      });
    }

    // Read an integer in the given radix. Return null if zero digits
    // were read, the integer value otherwise. When `len` is given, this
    // will return `null` unless the integer has exactly `len` digits.

  }, {
    key: 'readInt',
    value: function readInt(radix, len) {
      var start = this.state.pos;
      /* const forbiddenSiblings =
        radix === 16
          ? forbiddenNumericSeparatorSiblings.hex
          : forbiddenNumericSeparatorSiblings.decBinOct; */
      /* const allowedSiblings = {
        16: allowedNumericSeparatorSiblings.hex,
        10: allowedNumericSeparatorSiblings.dec,
        8: allowedNumericSeparatorSiblings.oct
      }[radix] || allowedNumericSeparatorSiblings.bin; */

      var total = 0;

      for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
        var code = this.input.charCodeAt(this.state.pos);
        var val = void 0;
        /*
        if (this.hasPlugin('numericSeparator')) { // TODO: Do we want this?
          const prev = this.input.charCodeAt(this.state.pos - 1);
          const next = this.input.charCodeAt(this.state.pos + 1);
          if (code === charCodes.underscore) {
            if (allowedSiblings.indexOf(next) === -1) {
              this.raise(this.state.pos, 'Invalid or unexpected token');
            }
             if (
              forbiddenSiblings.indexOf(prev) > -1 ||
              forbiddenSiblings.indexOf(next) > -1 ||
              Number.isNaN(next)
            ) {
              this.raise(this.state.pos, 'Invalid or unexpected token');
            }
             // Ignore this _ character
            ++this.state.pos;
            continue; // eslint-disable-line no-continue
          }
        }
        */
        if (code >= lowercaseA) {
          val = code - (lowercaseA + lineFeed);
        } else if (code >= uppercaseA) {
          val = code - (uppercaseA + lineFeed);
        } else if (isDigit(code)) {
          val = code - digit0; // 0-9
        } else {
          val = Infinity;
        }
        if (val >= radix) break;
        ++this.state.pos;
        total = total * radix + val;
      }
      if (this.state.pos === start || len != null && this.state.pos - start !== len) {
        return null;
      }

      return total;
    }
  }, {
    key: 'readRadixNumber',
    value: function readRadixNumber(radix) {
      var start = this.state.pos;
      var isBigInt = false;

      this.state.pos += 2; // 0x
      var val = this.readInt(radix);
      if (val == null) {
        this.raise(this.state.start + 2, 'Expected number in radix ' + radix);
      }

      if (this.input.charCodeAt(this.state.pos) === lowercaseN) {
        ++this.state.pos;
        isBigInt = true;
      }

      if (isIdentifierStart(this.fullCharCodeAtPos())) {
        this.raise(this.state.pos, 'Identifier directly after number');
      }

      if (isBigInt) {
        var str = this.input.slice(start, this.state.pos).replace(/[_n]/g, '');
        this.finishToken(types.bigint, str);
        return;
      }

      this.finishToken(types.num, val);
    }

    // Read an integer, octal integer, or floating-point number.

  }, {
    key: 'readNumber',
    value: function readNumber(startsWithDot) {
      var start = this.state.pos;
      var octal = this.input.charCodeAt(start) === digit0;
      var isFloat = false;
      var isBigInt = false;

      if (!startsWithDot && this.readInt(10) === null) {
        this.raise(start, 'Invalid number');
      }
      if (octal && this.state.pos === start + 1) octal = false; // number === 0

      var next = this.input.charCodeAt(this.state.pos);
      if (next === dot && !octal) {
        ++this.state.pos;
        this.readInt(10);
        isFloat = true;
        next = this.input.charCodeAt(this.state.pos);
      }

      if ((next === uppercaseE || next === lowercaseE) && !octal) {
        next = this.input.charCodeAt(++this.state.pos);
        if (next === plusSign || next === dash) {
          ++this.state.pos;
        }
        if (this.readInt(10) === null) this.raise(start, 'Invalid number');
        isFloat = true;
        next = this.input.charCodeAt(this.state.pos);
      }

      /* if (this.hasPlugin('bigInt')) { // TODO: Do we want this?
        if (next === charCodes.lowercaseN) {
          // disallow floats and legacy octal syntax, new style octal ("0o") is handled in this.readRadixNumber
          if (isFloat || octal) this.raise(start, 'Invalid BigIntLiteral');
          ++this.state.pos;
          isBigInt = true;
        }
      } */

      if (isIdentifierStart(this.fullCharCodeAtPos())) {
        this.raise(this.state.pos, 'Identifier directly after number');
      }

      // remove "_" for numeric literal separator, and "n" for BigInts
      var str = this.input.slice(start, this.state.pos).replace(/[_n]/g, '');

      if (isBigInt) {
        this.finishToken(types.bigint, str);
        return;
      }

      var val = void 0;
      if (isFloat) {
        val = parseFloat(str);
      } else if (!octal || str.length === 1) {
        val = parseInt(str, 10);
      } else if (this.state.strict) {
        this.raise(start, 'Invalid number');
      } else if (/[89]/.test(str)) {
        val = parseInt(str, 10);
      } else {
        val = parseInt(str, 8);
      }
      this.finishToken(types.num, val);
    }

    // Read a string value, interpreting backslash-escapes.

  }, {
    key: 'readCodePoint',
    value: function readCodePoint(throwOnInvalid) {
      var ch = this.input.charCodeAt(this.state.pos);
      var code = void 0;

      if (ch === leftCurlyBrace) {
        var codePos = ++this.state.pos;
        code = this.readHexChar(this.input.indexOf('}', this.state.pos) - this.state.pos, throwOnInvalid);
        ++this.state.pos;
        if (code === null) {
          // $FlowFixMe (is this always non-null?)
          --this.state.invalidTemplateEscapePosition; // to point to the '\'' instead of the 'u'
        } else if (code > 0x10ffff) {
          if (throwOnInvalid) {
            this.raise(codePos, 'Code point out of bounds');
          } else {
            this.state.invalidTemplateEscapePosition = codePos - 2;
            return null;
          }
        }
      } else {
        code = this.readHexChar(4, throwOnInvalid);
      }
      return code;
    }
  }, {
    key: 'readString',
    value: function readString(quote) {
      var out = '';
      var chunkStart = ++this.state.pos;
      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, 'Unterminated string constant');
        }
        var ch = this.input.charCodeAt(this.state.pos);
        if (ch === quote) break;
        if (ch === backslash) {
          out += this.input.slice(chunkStart, this.state.pos);
          // $FlowFixMe
          out += this.readEscapedChar(false);
          chunkStart = this.state.pos;
        } else {
          if (isNewLine(ch)) {
            this.raise(this.state.start, 'Unterminated string constant');
          }
          ++this.state.pos;
        }
      }
      out += this.input.slice(chunkStart, this.state.pos++);
      this.finishToken(types.string, out);
    }

    // Reads template string tokens.

  }, {
    key: 'readTmplToken',
    value: function readTmplToken() {
      var out = '';
      var chunkStart = this.state.pos;
      var containsInvalid = false;
      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, 'Unterminated template');
        }
        var ch = this.input.charCodeAt(this.state.pos);
        if (ch === graveAccent || ch === dollarSign && this.input.charCodeAt(this.state.pos + 1) === leftCurlyBrace) {
          if (this.state.pos === this.state.start && this.match(types.template)) {
            if (ch === dollarSign) {
              this.state.pos += 2;
              this.finishToken(types.dollarBraceL);
              return;
            }
            ++this.state.pos;
            this.finishToken(types.backQuote);
            return;
          }
          out += this.input.slice(chunkStart, this.state.pos);
          this.finishToken(types.template, containsInvalid ? null : out);
          return;
        }
        if (ch === backslash) {
          out += this.input.slice(chunkStart, this.state.pos);
          var escaped = this.readEscapedChar(true);
          if (escaped === null) {
            containsInvalid = true;
          } else {
            out += escaped;
          }
          chunkStart = this.state.pos;
        } else if (isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.state.pos);
          ++this.state.pos;
          switch (ch) {
            case carriageReturn:
              if (this.input.charCodeAt(this.state.pos) === lineFeed) {
                ++this.state.pos;
              }
            case lineFeed:
              out += '\n';
              break;
            default:
              out += String.fromCharCode(ch);
              break;
          }
          ++this.state.curLine;
          this.state.lineStart = this.state.pos;
          chunkStart = this.state.pos;
        } else {
          ++this.state.pos;
        }
      }
    }

    // Used to read escaped characters

  }, {
    key: 'readEscapedChar',
    value: function readEscapedChar(inTemplate) {
      var throwOnInvalid = !inTemplate;
      var ch = this.input.charCodeAt(++this.state.pos);
      ++this.state.pos;
      switch (ch) {
        case lowercaseN:
          return '\n';
        case lowercaseR:
          return '\r';
        case lowercaseX:
          {
            var code = this.readHexChar(2, throwOnInvalid);
            return code === null ? null : String.fromCharCode(code);
          }
        case lowercaseU:
          {
            var _code = this.readCodePoint(throwOnInvalid);
            return _code === null ? null : codePointToString(_code);
          }
        case lowercaseT:
          return '\t';
        case lowercaseB:
          return '\b';
        case lowercaseV:
          return '\x0B';
        case lowercaseF:
          return '\f';
        case carriageReturn:
          if (this.input.charCodeAt(this.state.pos) === lineFeed) {
            ++this.state.pos;
          }
        case lineFeed:
          this.state.lineStart = this.state.pos;
          ++this.state.curLine;
          return '';
        default:
          if (ch >= digit0 && ch <= digit7) {
            var codePos = this.state.pos - 1;
            // $FlowFixMe
            var octalStr = this.input.substr(this.state.pos - 1, 3).match(/^[0-7]+/)[0];
            var octal = parseInt(octalStr, 8);
            if (octal > 255) {
              octalStr = octalStr.slice(0, -1);
              octal = parseInt(octalStr, 8);
            }
            if (octal > 0) {
              if (inTemplate) {
                this.state.invalidTemplateEscapePosition = codePos;
                return null;
              } else if (this.state.strict) {
                this.raise(codePos, 'Octal literal in strict mode');
              } else if (!this.state.containsOctal) {
                // These properties are only used to throw an error for an octal which occurs
                // in a directive which occurs prior to a "use strict" directive.
                this.state.containsOctal = true;
                this.state.octalPosition = codePos;
              }
            }
            this.state.pos += octalStr.length - 1;
            return String.fromCharCode(octal);
          }
          return String.fromCharCode(ch);
      }
    }

    // Used to read character escape sequences ('\x', '\u').

  }, {
    key: 'readHexChar',
    value: function readHexChar(len, throwOnInvalid) {
      var codePos = this.state.pos;
      var n = this.readInt(16, len);
      if (n === null) {
        if (throwOnInvalid) {
          this.raise(codePos, 'Bad character escape sequence');
        } else {
          this.state.pos = codePos - 1;
          this.state.invalidTemplateEscapePosition = codePos - 1;
        }
      }
      return n;
    }

    // Read an identifier, and return it as a string. Sets `this.state.containsEsc`
    // to whether the word contained a '\u' escape.
    //
    // Incrementally adds only escaped chars, adding other chunks as-is
    // as a micro-optimization.

  }, {
    key: 'readWord1',
    value: function readWord1() {
      this.state.containsEsc = false;
      var word = '';
      var first = true;
      var chunkStart = this.state.pos;
      while (this.state.pos < this.input.length) {
        var ch = this.fullCharCodeAtPos();
        if (isIdentifierChar(ch)) {
          this.state.pos += ch <= 0xffff ? 1 : 2;
        } else if (this.state.isIterator && ch === atSign) {
          this.state.pos += 1;
        } else if (ch === backslash) {
          this.state.containsEsc = true;

          word += this.input.slice(chunkStart, this.state.pos);
          var escStart = this.state.pos;

          if (this.input.charCodeAt(++this.state.pos) !== lowercaseU) {
            this.raise(this.state.pos, 'Expecting Unicode escape sequence \\uXXXX');
          }

          ++this.state.pos;
          var esc = this.readCodePoint(true);
          // $FlowFixMe (thinks esc may be null, but throwOnInvalid is true)
          if (!(first ? isIdentifierStart : isIdentifierChar)(esc, true)) {
            this.raise(escStart, 'Invalid Unicode escape');
          }

          // $FlowFixMe
          word += codePointToString(esc);
          chunkStart = this.state.pos;
        } else {
          break;
        }
        first = false;
      }
      return word + this.input.slice(chunkStart, this.state.pos);
    }

    // Read an identifier or keyword token. Will check for reserved
    // words when necessary.

  }, {
    key: 'readWord',
    value: function readWord() {
      var word = this.readWord1();
      var type = types.name;

      if (isKeyword(word)) {
        if (this.state.containsEsc) {
          this.raise(this.state.pos, 'Escape sequence in keyword ' + word);
        }

        type = keywords[word];
      }

      this.finishToken(type, word);
    }
  }, {
    key: 'braceIsBlock',
    value: function braceIsBlock(prevType) {
      if (prevType === types.colon) {
        var parent = this.curContext();
        if (parent === types$1.braceStatement || parent === types$1.braceExpression) {
          return !parent.isExpr;
        }
      }

      if (prevType === types._return) {
        return lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
      }

      if (prevType === types._else || prevType === types.semi || prevType === types.eof || prevType === types.parenR) {
        return true;
      }

      if (prevType === types.braceL) {
        return this.curContext() === types$1.braceStatement;
      }

      if (prevType === types.relational) {
        // `class C<T> { ... }`
        return true;
      }

      return !this.state.exprAllowed;
    }
  }, {
    key: 'updateContext',
    value: function updateContext(prevType) {
      var type = this.state.type;


      if (type.keyword && (prevType === types.dot || prevType === types.questionDot)) {
        this.state.exprAllowed = false;
      } else if (type.updateContext) {
        type.updateContext.call(this, prevType);
      } else {
        this.state.exprAllowed = type.beforeExpr;
      }
    }
  }]);
  return Tokenizer;
}(LocationParser);

// ## Parser utilities

var UtilParser = function (_Tokenizer) {
  inherits(UtilParser, _Tokenizer);

  function UtilParser() {
    classCallCheck(this, UtilParser);
    return possibleConstructorReturn(this, (UtilParser.__proto__ || Object.getPrototypeOf(UtilParser)).apply(this, arguments));
  }

  createClass(UtilParser, [{
    key: 'addExtra',

    // TODO
    /* eslint-disable class-methods-use-this */
    value: function addExtra(node, key, val) {
      if (!node) return;

      var extra = node.extra = node.extra || {};
      extra[key] = val;
    }
    /* eslint-enable */

    // TODO

  }, {
    key: 'isRelational',
    value: function isRelational(op) {
      return this.match(types.relational) && this.state.value === op;
    }

    // TODO

  }, {
    key: 'expectRelational',
    value: function expectRelational(op) {
      if (this.isRelational(op)) {
        this.next();
      } else {
        this.unexpected(null, types.relational);
      }
    }

    // eat() for relational operators.

  }, {
    key: 'eatRelational',
    value: function eatRelational(op) {
      if (this.isRelational(op)) {
        this.next();
        return true;
      }
      return false;
    }

    // Tests whether parsed token is a contextual keyword.

  }, {
    key: 'isContextual',
    value: function isContextual(name) {
      return this.match(types.name) && this.state.value === name && !this.state.containsEsc;
    }
  }, {
    key: 'isLookaheadContextual',
    value: function isLookaheadContextual(name) {
      var l = this.lookahead();
      return l.type === types.name && l.value === name;
    }

    // Consumes contextual keyword if possible.

  }, {
    key: 'eatContextual',
    value: function eatContextual(name) {
      return this.isContextual(name) && this.eat(types.name);
    }

    // Asserts that following token is given contextual keyword.

  }, {
    key: 'expectContextual',
    value: function expectContextual(name, message) {
      if (!this.eatContextual(name)) this.unexpected(null, message);
    }
  }, {
    key: 'hasPrecedingLineBreak',
    value: function hasPrecedingLineBreak() {
      return lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
    }

    // TODO

  }, {
    key: 'isLineTerminator',
    value: function isLineTerminator() {
      return this.eat(types.semi) || (this.matchPrev(types.braceR) || this.matchPrev(types.semi)) && (this.hasPrecedingLineBreak() || this.match(types.eof));
    }

    // Consume a semicolon, or, failing that, see if we are allowed to
    // pretend that there is a semicolon at this position.

  }, {
    key: 'semicolon',
    value: function semicolon() {
      if (!this.isLineTerminator()) this.unexpected(null, types.semi);
    }

    // Expect a token of a given type. If found, consume it, otherwise,
    // raise an unexpected token error at given pos.

  }, {
    key: 'expect',
    value: function expect(type, pos) {
      return this.eat(type) || this.unexpected(pos, type);
    }

    // Raise an unexpected token error. Can take the expected token type
    // instead of a message string.

  }, {
    key: 'unexpected',
    value: function unexpected(pos, messageOrType) {
      if (messageOrType == null) messageOrType = 'Unexpected token';
      if (typeof messageOrType !== 'string') messageOrType = 'Unexpected token, expected "' + messageOrType.label + '"';
      throw this.raise(pos != null ? pos : this.state.start, messageOrType);
    }
  }]);
  return UtilParser;
}(Tokenizer);

// Start an AST node, attaching a start offset.

var commentKeys = ['leadingComments', 'trailingComments', 'innerComments'];

var Node = function () {
  function Node(parser, pos, loc) {
    classCallCheck(this, Node);

    this.type = '';
    this.start = pos;
    this.end = 0;
    this.loc = new SourceLocation(loc);
    if (parser && parser.options.ranges) this.range = [pos, 0];
    if (parser && parser.filename) this.loc.filename = parser.filename;
  }

  // type: string;
  // start: number;
  // end: number;
  // loc: SourceLocation;
  // range: [number, number];
  // leadingComments: Array<Comment>;
  // trailingComments: Array<Comment>;
  // innerComments: Array<Comment>;
  // extra: { [key: string]: any };

  createClass(Node, [{
    key: '__clone',
    value: function __clone() {
      var _this = this;

      // $FlowIgnore
      var node2 = new Node();
      Object.keys(this).forEach(function (key) {
        // Do not clone comments that are already attached to the node
        if (commentKeys.indexOf(key) < 0) {
          // $FlowIgnore
          node2[key] = _this[key];
        }
      });

      return node2;
    }
  }]);
  return Node;
}();

var NodeUtils = function (_UtilParser) {
  inherits(NodeUtils, _UtilParser);

  function NodeUtils() {
    classCallCheck(this, NodeUtils);
    return possibleConstructorReturn(this, (NodeUtils.__proto__ || Object.getPrototypeOf(NodeUtils)).apply(this, arguments));
  }

  createClass(NodeUtils, [{
    key: 'startNode',
    value: function startNode() {
      // $FlowIgnore
      return new Node(this, this.state.start, this.state.startLoc);
    }
  }, {
    key: 'startNodeAt',
    value: function startNodeAt(pos, loc) {
      // $FlowIgnore
      return new Node(this, pos, loc);
    }

    /** Start a new node with a previous node's location. */

  }, {
    key: 'startNodeAtNode',
    value: function startNodeAtNode(type) {
      return this.startNodeAt(type.start, type.loc.start);
    }

    // Finish an AST node, adding `type` and `end` properties.

  }, {
    key: 'finishNode',
    value: function finishNode(node, type) {
      return this.finishNodeAt(node, type, this.state.lastTokEnd, this.state.lastTokEndLoc);
    }

    // Finish node at given position

  }, {
    key: 'finishNodeAt',
    value: function finishNodeAt(node, type, pos, loc) {
      node.type = type;
      node.end = pos;
      node.loc.end = loc;
      if (this.options.ranges) node.range[1] = pos;
      this.processComment(node);
      return node;
    }

    /**
     * Reset the start location of node to the start location of locationNode
     */

  }, {
    key: 'resetStartLocationFromNode',
    value: function resetStartLocationFromNode(node, locationNode) {
      node.start = locationNode.start;
      node.loc.start = locationNode.loc.start;
      if (this.options.ranges) {

        var _locationNode$range = slicedToArray(locationNode.range, 1);

        node.range = _locationNode$range[0];
      }
    }
  }]);
  return NodeUtils;
}(UtilParser);

// @flow

var LValParser = function (_NodeUtils) {
  inherits(LValParser, _NodeUtils);

  function LValParser() {
    classCallCheck(this, LValParser);
    return possibleConstructorReturn(this, (LValParser.__proto__ || Object.getPrototypeOf(LValParser)).apply(this, arguments));
  }

  createClass(LValParser, [{
    key: 'toAssignable',

    // Convert existing expression atom to assignable pattern
    // if possible.

    value: function toAssignable(node, isBinding, contextDescription) {
      if (node) {
        switch (node.type) {
          case 'Identifier':
          case 'ObjectPattern':
          case 'ArrayPattern':
          case 'AssignmentPattern':
            break;

          case 'ObjectExpression':
            node.type = 'ObjectPattern';
            for (var index = 0; index < node.properties.length; index++) {
              var prop = node.properties[index];
              var isLast = index === node.properties.length - 1;
              this.toAssignableObjectExpressionProp(prop, isBinding, isLast);
            }
            break;

          case 'ObjectProperty':
            this.toAssignable(node.value, isBinding, contextDescription);
            break;

          case 'SpreadElement':
            {
              this.checkToRestConversion(node);

              node.type = 'RestElement';
              var arg = node.argument;
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
              this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
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

          default:
            {
              var message = 'Invalid left-hand side' + (contextDescription ? ' in ' + contextDescription : /* istanbul ignore next */' expression');
              this.raise(node.start, message);
            }
        }
      }
      return node;
    }
  }, {
    key: 'toAssignableObjectExpressionProp',
    value: function toAssignableObjectExpressionProp(prop, isBinding, isLast) {
      if (prop.type === 'ObjectMethod') {
        var error = prop.kind === 'get' || prop.kind === 'set' ? "Object pattern can't contain getter or setter" : "Object pattern can't contain methods";

        this.raise(prop.key.start, error);
      } else if (prop.type === 'SpreadElement' && !isLast) {
        this.raise(prop.start, 'The rest element has to be the last element when destructuring');
      } else {
        this.toAssignable(prop, isBinding, 'object destructuring pattern');
      }
    }

    // Convert list of expression atoms to binding list.

  }, {
    key: 'toAssignableList',
    value: function toAssignableList(exprList, isBinding, contextDescription) {
      var end = exprList.length;
      if (end) {
        var last = exprList[end - 1];
        if (last && last.type === 'RestElement') {
          --end;
        } else if (last && last.type === 'SpreadElement') {
          last.type = 'RestElement';
          var arg = last.argument;
          this.toAssignable(arg, isBinding, contextDescription);
          if (['Identifier', 'MemberExpression', 'ArrayPattern', 'ObjectPattern'].indexOf(arg.type) === -1) {
            this.unexpected(arg.start);
          }
          --end;
        }
      }
      for (var i = 0; i < end; i++) {
        var elt = exprList[i];
        if (elt && elt.type === 'SpreadElement') {
          this.raise(elt.start, 'The rest element has to be the last element when destructuring');
        }
        if (elt) this.toAssignable(elt, isBinding, contextDescription);
      }
      return exprList;
    }

    // Parses spread element.

  }, {
    key: 'parseSpread',
    value: function parseSpread(refShorthandDefaultPos, refNeedsArrowPos) {
      var node = this.startNode();
      this.next();
      node.argument = this.parseMaybeAssign(false, refShorthandDefaultPos, undefined, refNeedsArrowPos);
      return this.finishNode(node, 'SpreadElement');
    }
  }, {
    key: 'parseRest',
    value: function parseRest() {
      var node = this.startNode();
      this.next();
      node.argument = this.parseBindingAtom();
      return this.finishNode(node, 'RestElement');
    }
  }, {
    key: 'shouldAllowYieldIdentifier',
    value: function shouldAllowYieldIdentifier() {
      return this.match(types._yield) && !this.state.strict && !this.state.inGenerator;
    }
  }, {
    key: 'parseBindingIdentifier',
    value: function parseBindingIdentifier() {
      var id = this.parseIdentifier(this.shouldAllowYieldIdentifier());
      if (this.eat(types.hash)) {
        var node = this.startNode();
        node.destructurer = id;
        if (this.match(types.braceL)) {
          node.pattern = this.parseObj(true);
        } else if (this.match(types.bracketL)) {
          var collection = this.startNode();
          this.next();
          collection.elements = this.parseBindingList(types.bracketR, true);
          node.pattern = this.finishNode(collection, 'ArrayPattern');
        } else if (this.match(types.name)) {
          node.pattern = this.parseIdentifier(false);
        } else {
          this.unexpected(null, 'Invalid pattern in ColletionPattern');
        }
        return this.finishNode(node, 'CollectionPattern');
      }
      return id;
    }

    // Parses lvalue (assignable) atom.

  }, {
    key: 'parseBindingAtom',
    value: function parseBindingAtom() {
      if (isKeyword(this.state.type.label)) this.unexpected(null, 'Unexpected keyword in binding');
      switch (this.state.type) {
        case types.name:
          return this.parseBindingIdentifier();

        case types.bracketL:
          {
            var node = this.startNode();
            this.next();
            node.elements = this.parseBindingList(types.bracketR, true);
            return this.finishNode(node, 'ArrayPattern');
          }

        case types.braceL:
          return this.parseObj(true);

        default:
          throw this.unexpected();
      }
    }
  }, {
    key: 'parseBindingList',
    value: function parseBindingList(close, allowEmpty) {
      var elts = [];
      var first = true;
      while (!this.eat(close)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma);
        }
        if (allowEmpty && this.match(types.comma)) {
          elts.push(null);
        } else if (this.eat(close)) {
          break;
        } else if (this.match(types.ellipsis)) {
          elts.push(this.parseRest());
          this.expect(close);
          break;
        } else {
          elts.push(this.parseBindingAtom());
        }
      }
      return elts;
    }
  }, {
    key: 'parseAssignableListItem',
    value: function parseAssignableListItem(allowModifiers, decorators) {
      var left = this.parseMaybeDefault();
      var elt = this.parseMaybeDefault(left.start, left.loc.start, left);
      if (decorators.length) {
        left.decorators = decorators;
      }
      return elt;
    }

    // Parses assignment pattern around given atom if possible.

  }, {
    key: 'parseMaybeDefault',
    value: function parseMaybeDefault(startPos, startLoc, left) {
      startLoc = startLoc || this.state.startLoc;
      startPos = startPos || this.state.start;
      left = left || this.parseBindingAtom();
      if (!this.eat(types.eq)) return left;

      var node = this.startNodeAt(startPos, startLoc);
      node.left = left;
      node.right = this.parseMaybeAssign();
      return this.finishNode(node, 'AssignmentPattern');
    }

    // Verify that a node is an lval — something that can be assigned
    // to.

  }, {
    key: 'checkLVal',
    value: function checkLVal(expr, isBinding, checkClashes, contextDescription) {
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
            var key = '_' + expr.name;

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
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = expr.properties[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var prop = _step.value;

              if (prop.type === 'ObjectProperty') prop = prop.value;
              this.checkLVal(prop, isBinding, checkClashes, 'object destructuring pattern');
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }

          break;

        case 'ArrayPattern':
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = expr.elements[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var elem = _step2.value;

              if (elem) {
                this.checkLVal(elem, isBinding, checkClashes, 'array destructuring pattern');
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }

          break;

        case 'AssignmentPattern':
          this.checkLVal(expr.left, isBinding, checkClashes, 'assignment pattern');
          break;

        case 'RestElement':
          this.checkLVal(expr.argument, isBinding, checkClashes, 'rest element');
          break;

        case 'CollectionPattern':
          this.checkLVal(expr.pattern, isBinding, checkClashes, 'collection literal pattern');
          this.checkLVal(expr.destructurer, isBinding, checkClashes, 'collection literal collection name');
          break;

        default:
          {
            var message = (isBinding ? /* istanbul ignore next */'Binding invalid' : 'Invalid') + ' left-hand side' + (contextDescription ? ' in ' + contextDescription : /* istanbul ignore next */' expression');
            this.raise(expr.start, message);
          }
      }
    }
  }, {
    key: 'checkToRestConversion',
    value: function checkToRestConversion(node) {
      var validArgumentTypes = ['Identifier', 'MemberExpression'];

      if (validArgumentTypes.indexOf(node.argument.type) !== -1) {
        return;
      }

      this.raise(node.argument.start, "Invalid rest operator's argument");
    }
  }]);
  return LValParser;
}(NodeUtils);

// A recursive descent parser operates by defining functions for all

var ExpressionParser = function (_LValParser) {
  inherits(ExpressionParser, _LValParser);

  function ExpressionParser() {
    classCallCheck(this, ExpressionParser);
    return possibleConstructorReturn(this, (ExpressionParser.__proto__ || Object.getPrototypeOf(ExpressionParser)).apply(this, arguments));
  }

  createClass(ExpressionParser, [{
    key: 'checkPropClash',

    // Check if property name clashes with already added.
    // Object/class getters and setters are not allowed to clash —
    // either with each other or with an init property — and in
    // strict mode, init properties are also not allowed to be repeated.

    value: function checkPropClash(prop, propHash) {
      if (prop.computed || prop.kind) return;

      var key = prop.key;
      // It is either an Identifier or a String/NumericLiteral

      var name = key.type === 'Identifier' ? key.name : String(key.value);

      if (name === '__proto__') {
        if (propHash.proto) {
          this.raise(key.start, 'Redefinition of __proto__ property');
        }
        propHash.proto = true;
      }
    }

    // Convenience method to parse an Expression only

  }, {
    key: 'getExpression',
    value: function getExpression() {
      this.nextToken();
      var expr = this.parseExpression();
      if (!this.match(types.eof)) {
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

  }, {
    key: 'parseExpression',
    value: function parseExpression() {
      var isStatement = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      var starttype = this.state.type;
      var node = this.startNode();
      node.isStatement = isStatement;

      // Most types of expressions are recognized by the keyword they
      // start with. Many are trivial to parse, some require a bit of
      // complexity.

      switch (starttype) {
        case types._do:
          return this.parseDo(node);
        case types._for:
          return this.parseAnyFor(node);
        case types._function:
          return this.parseFunctionExpression();

        case types._class:
          return this.parseClass(node, false);

        case types._if:
          return this.parseIf(node);
        case types._switch:
          return this.parseSwitch(node);
        case types._try:
          return this.parseTry(node);
        case types._cond:
          return this.parseCond(node);

        case types._async:
          this.next();
          if (this.eat(types.parenL)) {
            var params = this.parseBindingList(types.parenR, false);
            if (!(this.match(types.arrow) || this.match(types.arrowThin))) this.unexpected();
            node.kind = this.eat(types.arrow) ? 'Thick' : 'Thin';
            return this.parseArrowExpression(node, params, true);
          }
          if (this.match(types.name)) {
            var id = this.parseIdentifier();
            if (!(this.match(types.arrow) || this.match(types.arrowThin))) this.unexpected();
            node.kind = this.eat(types.arrow) ? 'Thick' : 'Thin';
            return this.parseArrowExpression(node, [id], true);
          }
          return this.parseFunction(node, false, true, false);

        case types._let:
        case types._const:
        case types._var:
          return this.parseVar(node, false, starttype);

        case types._while:
          return this.parseWhile(node);
        default:
          return this.parseExpressionNoKeyword();
      }
    }
  }, {
    key: 'parseExpressionNoKeyword',
    value: function parseExpressionNoKeyword(refShorthandDefaultPos) {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;

      var expr = this.parseMaybeAssign(refShorthandDefaultPos);
      if (this.match(types.comma)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.expressions = [expr];
        while (this.eat(types.comma)) {
          node.expressions.push(this.parseMaybeAssign(refShorthandDefaultPos));
        }
        return this.finishNode(node, 'SequenceExpression');
      }
      return expr;
    }

    // TODO: Parse if else if else as a thing

  }, {
    key: 'parseIf',
    value: function parseIf(node) {
      this.next();
      node.test = this.parseParenExpression();
      node.consequent = this.parseBlock(true);
      node.alternate = this.eat(types._else) ? this.parseBlock(true) : null;
      return this.finishNode(node, 'If');
    }
  }, {
    key: 'parseReturn',
    value: function parseReturn(node) {
      if (!this.state.inFunction && !this.options.allowReturnOutsideFunction) {
        this.raise(this.state.start, "'return' outside of function");
      }
      this.next();
      if (this.match(types.semi)) {
        node.argument = null;
      } else {
        node.argument = this.parseExpression();
        this.semicolon();
      }

      return this.finishNode(node, 'Return');
    }
  }, {
    key: 'parseAnyFor',
    value: function parseAnyFor(node) {
      this.next();

      var forAwait = false;
      if (this.state.inAsync && this.isContextual('await')) {
        forAwait = true;
        this.next();
      }
      this.expect(types.parenL);

      if (this.match(types.semi)) {
        if (forAwait) {
          this.unexpected();
        }
        return this.parseFor(node, null);
      }

      if (this.match(types._var) || this.match(types._let) || this.match(types._const)) {
        var init = this.startNode();
        var varKind = this.state.type;
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
  }, {
    key: 'parseFor',
    value: function parseFor(node, init) {
      node.init = init === undefined ? this.parseExpressionNoKeyword() : init;
      this.expect(types.semi);
      node.test = this.match(types.semi) ? null : this.parseExpressionNoKeyword();
      this.expect(types.semi);
      node.update = this.match(types.parenR) ? null : this.parseExpressionNoKeyword();
      this.expect(types.parenR);
      node.body = this.parseBlock(true);
      this.state.labels.pop();
      return this.finishNode(node, 'For');
    }
  }, {
    key: 'parseForOf',
    value: function parseForOf(node, init, forAwait) {
      this.expectContextual('of');
      node.await = !!forAwait;
      node.left = init;
      node.right = this.parseExpression();
      this.expect(types.parenR);
      node.body = this.parseBlock(true);
      this.state.labels.pop();
      return this.finishNode(node, 'ForOf');
    }
  }, {
    key: 'parseWhile',
    value: function parseWhile(node) {
      this.next();
      node.test = this.parseParenExpression();
      node.body = this.parseBlock(true);
      return this.finishNode(node, 'While');
    }
  }, {
    key: 'parseSwitch',
    value: function parseSwitch(node) {
      this.next();
      node.discriminant = this.parseParenExpression();
      node.cases = [];
      this.expect(types.braceL);

      for (var sawDefault; !this.eat(types.braceR);) {
        if (this.match(types._case) || this.match(types._default)) {
          var isCase = this.match(types._case);
          var cur = this.startNode();
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
  }, {
    key: 'parseTry',
    value: function parseTry(node) {
      this.next();

      node.block = this.parseBlock(true);
      node.handler = null;

      if (this.match(types._catch)) {
        var clause = this.startNode();
        this.next();
        if (this.match(types.parenL)) {
          this.expect(types.parenL);
          clause.param = this.parseBindingAtom();
          this.checkLVal(clause.param, true, Object.create(null), 'catch clause');
          this.expect(types.parenR);
        } else {
          clause.param = null;
        }
        clause.body = this.parseBlock();
        node.handler = this.finishNode(clause, 'CatchClause');
      }

      node.finalizer = this.eat(types._finally) ? this.parseBlock(true) : null;

      if (!node.handler && !node.finalizer) {
        this.raise(node.start, 'Missing catch or finally clause');
      }

      return this.finishNode(node, 'TryStatement');
    }

    // Parse a list of variable declarations.

  }, {
    key: 'parseVar',
    value: function parseVar(node, isFor, kind) {
      node.declarations = [];
      node.kind = kind.keyword;
      this.next();
      if (this.match(types.comma) || this.match(types.semi)) this.unexpected(node.kind + ' requires declarations');
      do {
        var decl = this.startNode();
        this.parseVarHead(decl);
        if (this.eat(types.eq)) {
          decl.init = this.parseExpression();
        } else {
          if (node.kind === types._const) {
            this.unexpected();
          } else if (decl.id.type !== 'Identifier' && !this.isContextual('of')) {
            this.raise(this.state.lastTokEnd, 'Complex binding patterns require an initialization value');
          }
          decl.init = null;
        }
        node.declarations.push(this.finishNode(decl, 'VariableDeclarator'));
      } while (this.eat(types.comma));
      return this.finishNode(node, 'VariableDeclaration');
    }
  }, {
    key: 'parseVarHead',
    value: function parseVarHead(decl) {
      decl.id = this.parseBindingAtom();
      this.checkLVal(decl.id, true, undefined, 'variable declaration');
    }
  }, {
    key: 'parseCond',
    value: function parseCond() {
      var node = this.startNode();
      this.expect(types._cond);
      node.descriminent = this.parseParenExpression();
      this.expect(types.braceL);
      node.items = this.parseCondBlock();
      return this.finishNode(node, 'Cond');
    }
  }, {
    key: 'parseCondBlock',
    value: function parseCondBlock() {
      var items = [];
      while (!this.eat(types.braceR)) {
        var item = this.startNode();
        item.matcher = this.parseCondMatcher();
        this.expect(types.arrow);
        item.consequent = this.parseBlock(true);
        this.semicolon();
        items.push(this.finishNode(item, 'CondItem'));
      }
      return items;
    }
  }, {
    key: 'parseCondMatcher',
    value: function parseCondMatcher() {
      var matcher = this.startNode();
      switch (this.state.type) {
        case types.name:
          matcher.id = this.parseIdentifier();
          if (this.eat(types.hash)) {
            matcher.collection = this.parseCondMatcher();
            return this.finishNode(matcher, 'CollectionMatcher');
          }
          return this.finishNode(matcher, 'VariableMatcher');
        case types.braceL:
          return this.parseCondObjectMatcher(matcher);
        case types.bracketL:
          return this.parseCondArrayMatcher(matcher);
        default:
          matcher.expression = this.parseExpression();
          return this.finishNode(matcher, 'ExpressionMatcher');
      }
    }
  }, {
    key: 'parseCondObjectMatcher',
    value: function parseCondObjectMatcher(matcher) {
      this.expect(types.braceL);
      matcher.props = [];
      while (!this.eat(types.braceR)) {
        var prop = this.startNode();
        this.parsePropertyName(prop);
        if (this.eat(types.colon)) {
          prop.value = this.parseCondMatcher();
        }
        matcher.props.push(this.finishNode(prop, 'ObjectMatcherProperty'));
        if (!(this.eat(types.comma) || this.match(types.braceR))) this.unexpected(null, types.comma);
      }
      return this.finishNode(matcher, 'ObjectMatcher');
    }
  }, {
    key: 'parseCondArrayMatcher',
    value: function parseCondArrayMatcher(matcher) {
      this.expect(types.bracketL);
      matcher.parts = [];
      while (!this.eat(types.bracketR)) {
        matcher.parts.push(this.parseCondMatcher());
        if (!(this.eat(types.comma) || this.match(types.bracketR))) this.unexpected(null, types.comma);
      }
      return this.finishNode(matcher, 'ArrayMatcher');
    }
    // Parse an assignment expression. This includes applications of
    // operators like `+=`.

  }, {
    key: 'parseMaybeAssign',
    value: function parseMaybeAssign(refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos) {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;

      if (this.match(types._yield) && this.state.inGenerator) {
        var _left = this.parseYield();
        if (afterLeftParse) {
          _left = afterLeftParse.call(this, _left, startPos, startLoc);
        }
        return _left;
      }

      var failOnShorthandAssign = void 0;
      if (refShorthandDefaultPos) {
        failOnShorthandAssign = false;
      } else {
        refShorthandDefaultPos = { start: 0 };
        failOnShorthandAssign = true;
      }

      if (this.match(types.parenL) || this.match(types.name)) {
        this.state.potentialArrowAt = this.state.start;
      }

      var left = this.parseMaybeConditional(refShorthandDefaultPos, refNeedsArrowPos);
      if (afterLeftParse) {
        left = afterLeftParse.call(this, left, startPos, startLoc);
      }
      if (this.state.type.isAssign) {
        var node = this.startNodeAt(startPos, startLoc);
        var operator = this.state.value;
        node.operator = operator;

        node.left = this.match(types.eq) ? this.toAssignable(left, undefined, 'assignment expression') : left;
        refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly

        this.checkLVal(left, undefined, undefined, 'assignment expression');

        if (left.extra && left.extra.parenthesized) {
          var errorMsg = void 0;
          if (left.type === 'ObjectPattern') {
            errorMsg = '`({a}) = 0` use `({a} = 0)`';
          } else if (left.type === 'ArrayPattern') {
            errorMsg = '`([a]) = 0` use `([a] = 0)`';
          }
          if (errorMsg) {
            this.raise(left.start, 'You\'re trying to assign to a parenthesized expression, eg. instead of ' + errorMsg);
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

  }, {
    key: 'parseMaybeConditional',
    value: function parseMaybeConditional(refShorthandDefaultPos, refNeedsArrowPos) {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;
      var potentialArrowAt = this.state.potentialArrowAt;

      var expr = this.parseExprOps(refShorthandDefaultPos);

      if (expr.type === 'ArrowFunction' && expr.start === potentialArrowAt) {
        return expr;
      }
      if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;

      return this.parseConditional(expr, startPos, startLoc, refNeedsArrowPos);
    }
  }, {
    key: 'parseConditional',
    value: function parseConditional(expr, startPos, startLoc,
    // FIXME: Disabling this for now since can't seem to get it to play nicely
    // eslint-disable-next-line no-unused-vars
    refNeedsArrowPos) {
      if (this.eat(types.question)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.test = expr;
        node.consequent = this.parseMaybeAssign();
        this.expect(types.colon);
        node.alternate = this.parseMaybeAssign();
        return this.finishNode(node, 'ConditionalExpression');
      }
      return expr;
    }

    // Start the precedence parser.

  }, {
    key: 'parseExprOps',
    value: function parseExprOps(refShorthandDefaultPos) {
      var startPos = this.state.start;
      var _state = this.state,
          startLoc = _state.startLoc,
          potentialArrowAt = _state.potentialArrowAt;

      var expr = this.parseMaybeUnary(refShorthandDefaultPos);

      if (expr.type === 'ArrowFunction' && expr.start === potentialArrowAt) {
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

  }, {
    key: 'parseExprOp',
    value: function parseExprOp(left, leftStartPos, leftStartLoc, minPrec) {
      var prec = this.state.type.binop;
      if (this.match(types.pipeline) && this.state.noPipe) {
        return left;
      }
      if (prec != null && !this.match(types._in)) {
        if (prec > minPrec) {
          var node = this.startNodeAt(leftStartPos, leftStartLoc);
          var operator = this.state.value;
          node.left = left;
          node.operator = operator;

          if (operator === '**' && left.type === 'UnaryExpression' && left.extra && !left.extra.parenthesizedArgument && !left.extra.parenthesized) {
            this.raise(left.argument.start, 'Illegal expression. Wrap left hand side or entire exponentiation in parentheses.');
          }

          var op = this.state.type;

          this.next();

          var startPos = this.state.start;
          var startLoc = this.state.startLoc;


          if (op === types.pipeline) {
            // Support syntax such as 10 |> x => x + 1
            this.state.potentialArrowAt = startPos;
          }

          node.right = this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, op.rightAssociative ? prec - 1 : prec);

          this.finishNode(node, op === types.logicalOR || op === types.logicalAND || op === types.nullishCoalescing ? 'LogicalExpression' : 'BinaryExpression');
          return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec);
        }
      }
      return left;
    }

    // Parse unary operators, both prefix and postfix.

  }, {
    key: 'parseMaybeUnary',
    value: function parseMaybeUnary(refShorthandDefaultPos) {
      if (this.state.type.prefix) {
        var node = this.startNode();
        var update = this.match(types.incDec);
        node.operator = this.state.value;
        node.prefix = true;
        this.next();

        var argType = this.state.type;
        node.argument = this.parseMaybeUnary();

        this.addExtra(node, 'parenthesizedArgument', argType === types.parenL && (!node.argument.extra || !node.argument.extra.parenthesized));

        if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
          this.unexpected(refShorthandDefaultPos.start);
        }

        if (update) {
          this.checkLVal(node.argument, undefined, undefined, 'prefix operation');
        } else if (this.state.strict && node.operator === 'delete') {
          var arg = node.argument;

          if (arg.type === 'Identifier') {
            this.raise(node.start, 'Deleting local variable in strict mode');
          } else if (arg.type === 'MemberExpression' && arg.property.type === 'PrivateName') {
            this.raise(node.start, 'Deleting a private field is not allowed');
          }
        }

        return this.finishNode(node, update ? 'UpdateExpression' : 'UnaryExpression');
      }

      var startPos = this.state.start;
      var startLoc = this.state.startLoc;

      var expr = this.parseExprSubscripts(refShorthandDefaultPos);
      if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
      while (this.state.type.postfix && !this.match(types.semi)) {
        var _node = this.startNodeAt(startPos, startLoc);
        _node.operator = this.state.value;
        _node.prefix = false;
        _node.argument = expr;
        this.checkLVal(expr, undefined, undefined, 'postfix operation');
        this.next();
        expr = this.finishNode(_node, 'UpdateExpression');
      }
      return expr;
    }

    // Parse call, dot, and `[]`-subscript expressions.

  }, {
    key: 'parseExprSubscripts',
    value: function parseExprSubscripts(refShorthandDefaultPos) {
      var startPos = this.state.start;
      var _state2 = this.state,
          startLoc = _state2.startLoc,
          potentialArrowAt = _state2.potentialArrowAt;

      var expr = this.parseExprAtom(refShorthandDefaultPos);

      if (expr.type === 'ArrowFunction' && expr.start === potentialArrowAt) {
        return expr;
      }

      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        return expr;
      }

      return this.parseSubscripts(expr, startPos, startLoc);
    }
  }, {
    key: 'parseSubscripts',
    value: function parseSubscripts(base, startPos, startLoc, noCalls) {
      var state = {
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

  }, {
    key: 'parseSubscript',
    value: function parseSubscript(base, startPos, startLoc, noCalls, state) {
      if (!noCalls && this.eat(types.doubleColon)) {
        var node = this.startNodeAt(startPos, startLoc);
        node.object = base;
        node.callee = this.parseNoCallExpr();
        state.stop = true;
        return this.parseSubscripts(this.finishNode(node, 'BindExpression'), startPos, startLoc, noCalls);
      } else if (this.match(types.questionDot)) {
        state.optionalChainMember = true;
        if (noCalls && this.lookahead().type === types.parenL) {
          state.stop = true;
          return base;
        }
        this.next();

        var _node2 = this.startNodeAt(startPos, startLoc);

        if (this.eat(types.bracketL)) {
          _node2.object = base;
          _node2.property = this.parseMember();
          _node2.computed = true;
          _node2.optional = true;
          this.expect(types.bracketR);
          return this.finishNode(_node2, 'OptionalMemberExpression');
        } else if (this.eat(types.parenL)) {
          _node2.callee = base;
          _node2.arguments = this.parseCallExpressionArguments(types.parenR);
          _node2.optional = true;

          return this.finishNode(_node2, 'OptionalCallExpression');
        }
        _node2.object = base;
        _node2.property = this.parseIdentifier();
        _node2.computed = false;
        _node2.optional = true;
        return this.finishNode(_node2, 'OptionalMemberExpression');
      } else if (this.eat(types.dot)) {
        var _node3 = this.startNodeAt(startPos, startLoc);
        _node3.object = base;
        _node3.property = this.parseIdentifier();
        _node3.computed = false;
        if (state.optionalChainMember) {
          _node3.optional = false;
          return this.finishNode(_node3, 'OptionalMemberExpression');
        }
        return this.finishNode(_node3, 'MemberExpression');
      } else if (this.eat(types.bracketL)) {
        var _node4 = this.startNodeAt(startPos, startLoc);
        _node4.object = base;
        _node4.property = this.parseMember();
        _node4.computed = true;
        this.expect(types.bracketR);
        if (state.optionalChainMember) {
          _node4.optional = false;
          return this.finishNode(_node4, 'OptionalMemberExpression');
        }
        return this.finishNode(_node4, 'MemberExpression');
      } else if (!noCalls && this.match(types.parenL)) {
        this.next();

        var _node5 = this.startNodeAt(startPos, startLoc);
        _node5.callee = base;

        // TODO: Clean up/merge this into `this.state` or a class like acorn's
        // `DestructuringErrors` alongside refShorthandDefaultPos and
        // refNeedsArrowPos.
        var refTrailingCommaPos = { start: -1 };

        _node5.arguments = this.parseCallExpressionArguments(types.parenR, refTrailingCommaPos);
        if (this.match(types.braceL) || this.match(types._do)) {
          state.stop = true;
          var blockParam = this.startNode();
          blockParam.body = [];
          blockParam.isDo = this.eat(types._do);
          if (blockParam.isDo && this.match(types.parenL)) {
            this.parseFunctionParams(blockParam, false);
          } else {
            blockParam.params = [];
          }
          this.parseFunctionBody(blockParam, false, true);
          _node5.blockParam = this.finishNode(blockParam, 'BlockParam');
        }

        if (!state.optionalChainMember) {
          this.finishCallExpression(_node5);
        } else {
          this.finishOptionalCallExpression(_node5);
        }

        return _node5;
      } else if (this.match(types.backQuote)) {
        var _node6 = this.startNodeAt(startPos, startLoc);
        _node6.tag = base;
        _node6.quasi = this.parseTemplate(true);
        if (state.optionalChainMember) {
          this.raise(startPos, 'Tagged Template Literals are not allowed in optionalChain');
        }
        return this.finishNode(_node6, 'TaggedTemplateExpression');
      }
      state.stop = true;
      return base;
    }
  }, {
    key: 'finishCallExpression',
    value: function finishCallExpression(node) {
      if (node.callee.type === 'Import') {
        if (node.arguments.length !== 1) {
          this.raise(node.start, 'import() requires exactly one argument');
        }

        var importArg = node.arguments[0];
        if (importArg && importArg.type === 'SpreadElement') {
          this.raise(importArg.start, '... is not allowed in import()');
        }
      }
      return this.finishNode(node, 'CallExpression');
    }
  }, {
    key: 'finishOptionalCallExpression',
    value: function finishOptionalCallExpression(node) {
      if (node.callee.type === 'Import') {
        if (node.arguments.length !== 1) {
          this.raise(node.start, 'import() requires exactly one argument');
        }

        var importArg = node.arguments[0];
        if (importArg && importArg.type === 'SpreadElement') {
          this.raise(importArg.start, '... is not allowed in import()');
        }
      }
      return this.finishNode(node, 'OptionalCallExpression');
    }
  }, {
    key: 'parseCallExpressionArguments',
    value: function parseCallExpressionArguments(close, refTrailingCommaPos) {
      var elts = [];
      var innerParenStart = void 0;
      var first = true;

      while (!this.eat(close)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma);
          if (this.eat(close)) break;
        }

        // we need to make sure that if this is an async arrow functions,
        // that we don't allow inner parens inside the params
        if (this.match(types.parenL) && !innerParenStart) {
          innerParenStart = this.state.start;
        }

        elts.push(this.parseExprListItem(false, { start: 0 }, { start: 0 }, refTrailingCommaPos));
      }

      return elts;
    }
    // Parse a no-call expression (like argument of `new` or `::` operators).

  }, {
    key: 'parseNoCallExpr',
    value: function parseNoCallExpr() {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;

      return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
    }

    // Parse an atomic expression — either a single token that is an
    // expression, an expression started by a keyword like `function` or
    // `new`, or an expression wrapped in punctuation like `()`, `[]`,
    // or `{}`.

  }, {
    key: 'parseExprAtom',
    value: function parseExprAtom(refShorthandDefaultPos) {
      var canBeArrow = this.state.potentialArrowAt === this.state.start;
      switch (this.state.type) {
        case types._super:
          {
            if (!this.state.inMethod && !this.state.inClassProperty && !this.options.allowSuperOutsideMethod) {
              this.raise(this.state.start, 'super is only allowed in object methods and classes');
            }

            var node = this.startNode();
            this.next();
            if (!this.match(types.parenL) && !this.match(types.bracketL) && !this.match(types.dot)) {
              this.unexpected();
            }
            if (this.match(types.parenL) && this.state.inMethod !== 'constructor' && !this.options.allowSuperOutsideMethod) {
              this.raise(node.start, 'super() is only valid inside a class constructor. ' + "Make sure the method name is spelled exactly as 'constructor'.");
            }
            return this.finishNode(node, 'Super');
          }

        case types._import:
          {
            if (this.lookahead().type === types.dot) {
              return this.parseImportMetaProperty();
            }

            var _node7 = this.startNode();
            this.next();
            _node7.argument = this.parseParenExpression();
            return this.finishNode(_node7, 'Import');
          }

        case types._this:
          {
            var _node8 = this.startNode();
            this.next();
            return this.finishNode(_node8, 'ThisExpression');
          }

        case types.name:
          {
            var _node9 = this.startNode();
            var id = this.parseIdentifier();

            if (this.match(types.hash)) {
              _node9.constructor = id;
              this.next();
              if (this.match(types.braceL)) {
                _node9.collection = this.parseObj(false, refShorthandDefaultPos);
              } else if (this.match(types.bracketL)) {
                _node9.collection = this.parseArrayExpression(refShorthandDefaultPos);
              } else if (this.match(types.parenL)) {
                _node9.collection = this.parseParenAndDistinguishExpression(true, refShorthandDefaultPos);
              } else if (this.match(types.name)) {
                _node9.collection = this.parseIdentifier();
              } else {
                _node9.collection = this.parseExprAtom(refShorthandDefaultPos);
              }
              return this.finishNode(_node9, 'CollectionLiteral');
            } else if (canBeArrow && !this.match(types.semi) && (this.eat(types.arrow) || this.eat(types.arrowThin))) {
              var oldYield = this.state.yieldInPossibleArrowParameters;
              _node9.kind = this.matchPrev(types.arrow) ? 'Thick' : 'Thin';
              this.state.yieldInPossibleArrowParameters = null;
              this.parseArrowExpression(_node9, [id]);
              this.state.yieldInPossibleArrowParameters = oldYield;
              return _node9;
            }

            return id;
          }

        case types.regexp:
          {
            var value = this.state.value;

            var _node10 = this.parseLiteral(value.value, 'RegExpLiteral');
            _node10.pattern = value.pattern;
            _node10.flags = value.flags;
            return _node10;
          }

        case types.num:
          return this.parseLiteral(this.state.value, 'NumericLiteral');

        case types.bigint:
          return this.parseLiteral(this.state.value, 'BigIntLiteral');

        case types.string:
          return this.parseLiteral(this.state.value, 'StringLiteral');

        case types._null:
          {
            var _node11 = this.startNode();
            this.next();
            return this.finishNode(_node11, 'NullLiteral');
          }

        case types._true:
        case types._false:
          return this.parseBooleanLiteral();

        case types.parenL:
          return this.parseParenAndDistinguishExpression(canBeArrow);

        case types.bracketL:
          return this.parseArrayExpression(refShorthandDefaultPos);

        case types.braceL:
          return this.parseObj(false, refShorthandDefaultPos);

        case types._function:
          return this.parseFunctionExpression();

        case types._class:
          return this.parseClass(this.startNode(), false);

        case types._new:
          return this.parseNew();

        case types.backQuote:
          return this.parseTemplate(false);

        case types.doubleColon:
          {
            var _node12 = this.startNode();
            this.next();
            _node12.object = null;
            var callee = _node12.callee = this.parseNoCallExpr();
            if (callee.type === 'MemberExpression') {
              return this.finishNode(_node12, 'BindExpression');
            }
            throw this.raise(callee.start, 'Binding should be performed on object property.');
          }

        case types._return:
        case types._throw:
          {
            var _node13 = this.startNode();
            var type = this.match(types._return) ? 'Return' : 'Throw';
            if (this.match(types.semi)) this.unexpected(null, type + ' requires argument');
            this.next();
            _node13.argument = this.parseExpression();
            return this.finishNode(_node13, type);
          }

        case types._await:
          return this.parseAwait();

        case types._export:
          return this.unexpected(null, 'Cannot use export without being in the top level');

        case types._break:
        case types._debugger:
        case types._continue:
          {
            var _node14 = this.startNode();
            var _type = 'Break';
            if (this.match(types._debugger)) _type = 'Debugger';
            if (this.match(types._continue)) _type = 'Continue';
            this.next();
            return this.finishNode(_node14, _type);
          }

        default:
          throw this.unexpected();
      }
    }
  }, {
    key: 'parseDo',
    value: function parseDo() {
      var node = this.startNode();
      this.next();
      node.body = this.parseBlock(true);
      this.expect(types._while);
      node.test = this.parseParenExpression();
      this.eat(types.semi);
      return this.finishNode(node, 'DoWhile');
    }
  }, {
    key: 'parseBooleanLiteral',
    value: function parseBooleanLiteral() {
      var node = this.startNode();
      node.value = this.match(types._true);
      this.next();
      return this.finishNode(node, 'BooleanLiteral');
    }
  }, {
    key: 'parseFunctionExpression',
    value: function parseFunctionExpression() {
      var node = this.startNode();
      var meta = this.startNode();
      meta.name = 'function';
      this.next();
      if (this.state.inGenerator && this.eat(types.dot)) {
        return this.parseMetaProperty(node, this.finishNode(meta, 'Identifier'), 'sent');
      }
      return this.parseFunction(node, true);
    }
  }, {
    key: 'parseMetaProperty',
    value: function parseMetaProperty(node, meta, propertyName) {
      node.meta = meta;

      if (meta.name === 'function' && propertyName === 'sent') {
        if (this.isContextual(propertyName)) ;
        // this.expectPlugin('functionSent'); // TODO: Do we want this?
        /* else if (!this.hasPlugin('functionSent')) {
        // The code wasn't `function.sent` but just `function.`, so a simple error is less confusing.
        this.unexpected();
        } */
      }

      var containsEsc = this.state.containsEsc;


      node.property = this.parseIdentifier();

      if (node.property.name !== propertyName || containsEsc) {
        this.raise(node.property.start, 'The only valid meta property for ' + meta.name + ' is ' + meta.name + '.' + propertyName);
      }

      return this.finishNode(node, 'MetaProperty');
    }
  }, {
    key: 'parseImportMetaProperty',
    value: function parseImportMetaProperty() {
      var node = this.startNode();
      var id = this.parseIdentifier();
      this.expect(types.dot);
      return this.parseMetaProperty(node, id, 'meta');
    }
  }, {
    key: 'parseLiteral',
    value: function parseLiteral(value, type, startPos, startLoc) {
      startPos = startPos || this.state.start;
      startLoc = startLoc || this.state.startLoc;

      var node = this.startNodeAt(startPos, startLoc);
      this.addExtra(node, 'rawValue', value);
      this.addExtra(node, 'raw', this.input.slice(startPos, this.state.end));
      node.value = value;
      this.next();
      return this.finishNode(node, type);
    }
  }, {
    key: 'parseParenExpression',
    value: function parseParenExpression() {
      this.expect(types.parenL);
      var val = this.parseExpression();
      this.expect(types.parenR);
      return val;
    }
  }, {
    key: 'parseParenAndDistinguishExpression',
    value: function parseParenAndDistinguishExpression(canBeArrow) {
      var startPos = this.state.start;
      var startLoc = this.state.startLoc;


      var val = void 0;
      this.expect(types.parenL);

      var oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
      var oldYield = this.state.yieldInPossibleArrowParameters;
      this.state.maybeInArrowParameters = true;
      this.state.yieldInPossibleArrowParameters = null;

      var innerStartPos = this.state.start;
      var innerStartLoc = this.state.startLoc;
      var exprList = [];
      var refShorthandDefaultPos = { start: 0 };
      var refNeedsArrowPos = { start: 0 };
      var first = true;
      var spreadStart = void 0;
      var optionalCommaStart = void 0;

      while (!this.match(types.parenR)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma, refNeedsArrowPos.start || null);
          if (this.match(types.parenR)) {
            optionalCommaStart = this.state.start;
            break;
          }
        }

        if (this.match(types.ellipsis)) {
          var spreadNodeStartPos = this.state.start;
          var spreadNodeStartLoc = this.state.startLoc;
          spreadStart = this.state.start;
          exprList.push(this.parseParenItem(this.parseRest(), spreadNodeStartPos, spreadNodeStartLoc));

          if (this.match(types.comma) && this.lookahead().type === types.parenR) {
            this.raise(this.state.start, 'A trailing comma is not permitted after the rest element');
          }

          break;
        } else {
          exprList.push(this.parseMaybeAssign(refShorthandDefaultPos, null, refNeedsArrowPos));
        }
      }

      var innerEndPos = this.state.start;
      var innerEndLoc = this.state.startLoc;
      this.expect(types.parenR);

      this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

      var arrowNode = this.parseArrow(this.startNodeAt(startPos, startLoc));
      if (canBeArrow && this.shouldParseArrow() && arrowNode) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = exprList[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var param = _step.value;

            if (param.extra && param.extra.parenthesized) {
              this.unexpected(param.extra.parenStart);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
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
        val = exprList[0];
      }

      this.addExtra(val, 'parenthesized', true);
      this.addExtra(val, 'parenStart', startPos);

      return val;
    }
  }, {
    key: 'shouldParseArrow',
    value: function shouldParseArrow() {
      return !this.match(types.semi);
    }
  }, {
    key: 'parseArrow',
    value: function parseArrow(node) {
      if (this.eat(types.arrow) || this.eat(types.arrowThin)) {
        node.kind = this.matchPrev(types.arrow) ? 'Thick' : 'Thin';
        return node;
      }
      return false;
    }

    /* eslint-disable class-methods-use-this */

  }, {
    key: 'parseParenItem',
    value: function parseParenItem(node, startPos,
    // eslint-disable-next-line no-unused-vars
    startLoc) {
      return node;
    }
    /* eslint-enable class-methods-use-this */

    // New's precedence is slightly tricky. It must allow its argument to
    // be a `[]` or dot subscript expression, but not a call — at least,
    // not without wrapping it in parentheses. Thus, it uses the noCalls
    // argument to parseSubscripts to prevent it from consuming the
    // argument list.

  }, {
    key: 'parseNew',
    value: function parseNew() {
      var node = this.startNode();
      var meta = this.parseIdentifier();

      if (this.eat(types.dot)) {
        var metaProp = this.parseMetaProperty(node, meta, 'target');

        if (!this.state.inFunction && !this.state.inClassProperty) {
          var error = 'new.target can only be used in functions';

          this.raise(metaProp.start, error);
        }

        return metaProp;
      }

      node.callee = this.parseNoCallExpr();
      if (node.callee.type === 'OptionalMemberExpression' || node.callee.type === 'OptionalCallExpression') {
        this.raise(this.state.lastTokEnd, 'constructors in/after an Optional Chain are not allowed');
      }
      if (this.eat(types.questionDot)) {
        this.raise(this.state.start, 'constructors in/after an Optional Chain are not allowed');
      }
      this.parseNewArguments(node);
      return this.finishNode(node, 'NewExpression');
    }
  }, {
    key: 'parseNewArguments',
    value: function parseNewArguments(node) {
      if (this.eat(types.parenL)) {
        var args = this.parseExprList(types.parenR);
        // $FlowFixMe (parseExprList should be all non-null in this case)
        node.arguments = args;
      } else {
        node.arguments = [];
      }
    }

    // Parse template expression.

  }, {
    key: 'parseTemplateElement',
    value: function parseTemplateElement(isTagged) {
      var elem = this.startNode();
      if (this.state.value === null) {
        if (!isTagged) {
          // TODO: fix this
          this.raise(this.state.invalidTemplateEscapePosition || 0, 'Invalid escape sequence in template');
        } else {
          this.state.invalidTemplateEscapePosition = null;
        }
      }
      elem.value = {
        raw: this.input.slice(this.state.start, this.state.end).replace(/\r\n?/g, '\n'),
        cooked: this.state.value
      };
      this.next();
      elem.tail = this.match(types.backQuote);
      return this.finishNode(elem, 'TemplateElement');
    }
  }, {
    key: 'parseTemplate',
    value: function parseTemplate(isTagged) {
      var node = this.startNode();
      this.next();
      node.expressions = [];
      var curElt = this.parseTemplateElement(isTagged);
      node.quasis = [curElt];
      while (!curElt.tail) {
        this.expect(types.dollarBraceL);
        node.expressions.push(this.parseExpression());
        this.expect(types.braceR);
        node.quasis.push(curElt = this.parseTemplateElement(isTagged));
      }
      this.next();
      return this.finishNode(node, 'TemplateLiteral');
    }

    // Parse an object literal or binding pattern.

  }, {
    key: 'parseObj',
    value: function parseObj(isPattern, refShorthandDefaultPos) {
      var decorators = [];
      var propHash = Object.create(null);
      var first = true;
      var node = this.startNode();

      node.properties = [];
      this.next();

      var firstRestLocation = null;

      while (!this.eat(types.braceR)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma);
          if (this.eat(types.braceR)) break;
        }

        var prop = this.startNode();
        var isGenerator = false;
        var isAsync = false;
        var startPos = void 0;
        var startLoc = void 0;

        if (this.match(types.ellipsis)) {
          prop = this.parseSpread(isPattern ? { start: 0 } : undefined);
          if (isPattern) {
            this.toAssignable(prop, true, 'object pattern');
          }
          node.properties.push(prop);
          if (isPattern) {
            var position = this.state.start;
            if (firstRestLocation !== null) {
              this.unexpected(firstRestLocation, 'Cannot have multiple rest elements when destructuring');
            } else if (this.eat(types.braceR)) {
              break;
            } else if (this.match(types.comma) && this.lookahead().type === types.braceR) {
              this.unexpected(position, 'A trailing comma is not permitted after the rest element');
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
          startLoc = this.state.startLoc;
        }

        if (!isPattern) {
          isGenerator = this.eat(types.star);
        }

        var containsEsc = this.state.containsEsc;


        if (!isPattern && this.match(types._async)) {
          if (isGenerator) this.unexpected();

          var asyncId = this.parseIdentifier();
          if (this.match(types.colon) || this.match(types.parenL) || this.match(types.braceR) || this.match(types.eq) || this.match(types.comma)) {
            prop.key = asyncId;
            prop.computed = false;
          } else {
            isAsync = true;
            if (this.match(types.star)) {
              this.next();
              isGenerator = true;
            }
            this.parsePropertyName(prop);
          }
        } else {
          this.parsePropertyName(prop);
        }

        this.parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refShorthandDefaultPos, containsEsc);
        this.checkPropClash(prop, propHash);

        if (prop.shorthand) {
          this.addExtra(prop, 'shorthand', true);
        }

        node.properties.push(prop);
      }

      if (firstRestLocation !== null) {
        this.unexpected(firstRestLocation, 'The rest element has to be the last element when destructuring');
      }

      if (decorators.length) {
        this.raise(this.state.start, 'You have trailing decorators with no property');
      }

      return this.finishNode(node, isPattern ? 'ObjectPattern' : 'Object');
    }
  }, {
    key: 'isGetterOrSetterMethod',
    value: function isGetterOrSetterMethod(prop, isPattern) {
      return !isPattern && !prop.computed && prop.key.type === 'Identifier' && (prop.key.name === 'get' || prop.key.name === 'set') && (this.match(types.string) || // get "string"() {}
      this.match(types.num) || // get 1() {}
      this.match(types.bracketL) || // get ["string"]() {}
      this.match(types.name) || // get foo() {}
      !!this.state.type.keyword) // get debugger() {}
      ;
    }

    // get methods aren't allowed to have any parameters
    // set methods must have exactly 1 parameter which is not a rest parameter

  }, {
    key: 'checkGetterSetterParams',
    value: function checkGetterSetterParams(method) {
      var paramCount = method.kind === 'get' ? 0 : 1;
      var start = method.start;

      if (method.params.length !== paramCount) {
        if (method.kind === 'get') {
          this.raise(start, 'getter must not have any formal parameters');
        } else {
          this.raise(start, 'setter must have exactly one formal parameter');
        }
      }

      if (method.kind === 'set' && method.params[0].type === 'RestElement') {
        this.raise(start, 'setter function argument must not be a rest parameter');
      }
    }
  }, {
    key: 'parseObjectMethod',
    value: function parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) {
      if (isAsync || isGenerator || this.match(types.parenL)) {
        if (isPattern) this.unexpected();
        prop.kind = 'method';
        prop.method = true;
        return this.parseMethod(prop, isGenerator, isAsync,
        /* isConstructor */false, 'ObjectMethod');
      }

      if (!containsEsc && this.isGetterOrSetterMethod(prop, isPattern)) {
        if (isGenerator || isAsync) this.unexpected();
        prop.kind = prop.key.name;
        this.parsePropertyName(prop);
        this.parseMethod(prop,
        /* isGenerator */false,
        /* isAsync */false,
        /* isConstructor */false, 'ObjectMethod');
        this.checkGetterSetterParams(prop);
        return prop;
      }

      return false;
    }
  }, {
    key: 'parseObjectProperty',
    value: function parseObjectProperty(prop, startPos, startLoc, isPattern, refShorthandDefaultPos) {
      prop.shorthand = false;

      if (this.eat(types.colon)) {
        prop.value = isPattern ? this.parseMaybeDefault(this.state.start, this.state.startLoc) : this.parseMaybeAssign(refShorthandDefaultPos);

        return this.finishNode(prop, 'ObjectProperty');
      }

      if (!prop.computed && prop.key.type === 'Identifier') {
        if (isPattern) {
          prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
        } else if (this.match(types.eq) && refShorthandDefaultPos) {
          if (!refShorthandDefaultPos.start) {
            refShorthandDefaultPos.start = this.state.start;
          }
          prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key.__clone());
        } else {
          prop.value = prop.key.__clone();
        }
        prop.shorthand = true;

        return this.finishNode(prop, 'ObjectProperty');
      }

      return false;
    }
  }, {
    key: 'parseObjPropValue',
    value: function parseObjPropValue(prop, startPos, startLoc, isGenerator, isAsync, isPattern, refShorthandDefaultPos, containsEsc) {
      var node = this.parseObjectMethod(prop, isGenerator, isAsync, isPattern, containsEsc) || this.parseObjectProperty(prop, startPos, startLoc, isPattern, refShorthandDefaultPos);

      if (!node) this.unexpected();

      // $FlowFixMe
      return node;
    }
  }, {
    key: 'parsePropertyName',
    value: function parsePropertyName(prop) {
      if (this.eat(types.bracketL)) {
        prop.computed = true;
        prop.key = this.parseExpression();
        this.expect(types.bracketR);
      } else {
        var oldInPropertyName = this.state.inPropertyName;
        this.state.inPropertyName = true;
        // We check if it's valid for it to be a private name when we push it.
        prop.key = this.match(types.num) || this.match(types.string) ? this.parseExprAtom() : this.parseIdentifier();

        this.state.inPropertyName = oldInPropertyName;
      }

      return prop.key;
    }

    // Parse an Array Expression

  }, {
    key: 'parseArrayExpression',
    value: function parseArrayExpression(refShorthandDefaultPos) {
      var node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types.bracketR, true, refShorthandDefaultPos);
      return this.finishNode(node, 'Array');
    }

    // Initialize empty function node.

  }, {
    key: 'initFunction',
    value: function initFunction(node, isAsync) {
      node.id = null;
      node.generator = false;
      node.async = !!isAsync;
      return this;
    }

    // Parse object or class method.

  }, {
    key: 'parseMethod',
    value: function parseMethod(node, isGenerator, isAsync, isConstructor, type) {
      var oldInFunc = this.state.inFunction;
      var oldInMethod = this.state.inMethod;
      var oldInGenerator = this.state.inGenerator;
      this.state.inFunction = true;
      this.state.inMethod = node.kind || true;
      this.state.inGenerator = isGenerator;

      this.initFunction(node, isAsync);
      node.generator = !!isGenerator;
      var allowModifiers = isConstructor; // For TypeScript parameter properties
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

  }, {
    key: 'parseArrowExpression',
    value: function parseArrowExpression(node, params, isAsync) {
      var oldInFunc = this.state.inFunction;
      this.state.inFunction = true;
      this.initFunction(node, isAsync);
      if (params) this.setArrowFunctionParameters(node, params);

      this.parseFunctionMods(node);

      var oldInGenerator = this.state.inGenerator;
      var oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
      this.state.inGenerator = false;
      this.state.maybeInArrowParameters = false;
      this.parseFunctionBody(node, true, false, true);
      this.state.inGenerator = oldInGenerator;
      this.state.inFunction = oldInFunc;
      this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

      return this.finishNode(node, 'ArrowFunction');
    }
  }, {
    key: 'setArrowFunctionParameters',
    value: function setArrowFunctionParameters(node, params) {
      node.params = this.toAssignableList(params, true, 'arrow function parameters');
    }

    /* eslint-disable class-methods-use-this */

  }, {
    key: 'isStrictBody',
    value: function isStrictBody(node) {
      var isBlockStatement = node.body.type === 'BlockStatement';

      if (isBlockStatement && node.body.directives.length) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = node.body.directives[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var directive = _step2.value;

            if (directive.value.value === 'use strict') {
              return true;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      return false;
    }
    /* eslint-enable class-methods-use-this */

  }, {
    key: 'parseFunctionBodyAndFinish',
    value: function parseFunctionBodyAndFinish(node, type, allowExpressionBody) {
      this.parseFunctionBody(node, allowExpressionBody);
      this.finishNode(node, type);
    }

    // Parse function body and check parameters.

  }, {
    key: 'parseFunctionBody',
    value: function parseFunctionBody(node, allowExpression) {
      var noCheck = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var isArrow = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

      var oldInParameters = this.state.inParameters;
      var oldInAsync = this.state.inAsync;
      this.state.inParameters = false;
      this.state.inAsync = node.async;
      // Start a new scope with regard to labels and the `inGenerator`
      // flag (restore them to their old value afterwards).
      var oldInGen = this.state.inGenerator;
      var oldInFunc = this.state.inFunction;
      this.state.inGenerator = node.generator;
      this.state.inFunction = true;
      node.body = this.parseBlock(allowExpression, isArrow);
      this.state.inFunction = oldInFunc;
      this.state.inGenerator = oldInGen;
      this.state.inAsync = oldInAsync;

      if (!noCheck) this.checkFunctionNameAndParams(node, allowExpression);
      this.state.inParameters = oldInParameters;
    }
  }, {
    key: 'checkFunctionNameAndParams',
    value: function checkFunctionNameAndParams(node, isArrowFunction) {
      // If this is a strict mode function, verify that argument names
      // are not repeated, and it does not try to bind the words `eval`
      // or `arguments`.
      var isStrict = this.isStrictBody(node);
      // Also check for arrow functions
      var checkLVal = this.state.strict || isStrict || isArrowFunction;

      var oldStrict = this.state.strict;
      if (isStrict) this.state.strict = isStrict;

      if (checkLVal) {
        var nameHash = Object.create(null);
        if (node.id) {
          this.checkLVal(node.id, true, undefined, 'function name');
        }
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = node.params[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var param = _step3.value;

            if (isStrict && param.type !== 'Identifier') {
              this.raise(param.start, 'Non-simple parameter in strict mode');
            }
            this.checkLVal(param, true, nameHash, 'function parameter list');
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }
      this.state.strict = oldStrict;
    }

    // Parses a comma-separated list of expressions, and returns them as
    // an array. `close` is the token type that ends the list, and
    // `allowEmpty` can be turned on to allow subsequent commas with
    // nothing in between them to be parsed as `null` (which is needed
    // for array literals).

  }, {
    key: 'parseExprList',
    value: function parseExprList(close, allowEmpty, refShorthandDefaultPos) {
      var elts = [];
      var first = true;

      while (!this.eat(close)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma);
          if (this.eat(close)) break;
        }

        elts.push(this.parseExprListItem(allowEmpty, refShorthandDefaultPos));
      }
      return elts;
    }
  }, {
    key: 'parseExprListItem',
    value: function parseExprListItem(allowEmpty, refShorthandDefaultPos, refNeedsArrowPos, refTrailingCommaPos) {
      var elt = void 0;
      if (allowEmpty && this.match(types.comma)) {
        elt = null;
      } else if (this.match(types.ellipsis)) {
        var spreadNodeStartPos = this.state.start;
        var spreadNodeStartLoc = this.state.startLoc;
        elt = this.parseParenItem(this.parseSpread(refShorthandDefaultPos, refNeedsArrowPos), spreadNodeStartPos, spreadNodeStartLoc);

        if (refTrailingCommaPos && this.match(types.comma)) {
          refTrailingCommaPos.start = this.state.start;
        }
      } else {
        elt = this.parseMaybeAssign(refShorthandDefaultPos, this.parseParenItem, refNeedsArrowPos);
      }
      return elt;
    }

    // Parse the next token as an identifier.

  }, {
    key: 'parseIdentifier',
    value: function parseIdentifier() {
      var node = this.startNode();
      var name = this.parseIdentifierName();
      node.name = name;
      node.loc.identifierName = name;
      return this.finishNode(node, 'Identifier');
    }
  }, {
    key: 'parseIdentifierName',
    value: function parseIdentifierName() {
      var name = void 0;

      if (this.match(types.name)) {
        name = this.state.value;
      } else {
        throw this.unexpected();
      }
      this.next();
      return name;
    }

    // Parses await expression inside async function.

  }, {
    key: 'parseAwait',
    value: function parseAwait() {
      // istanbul ignore next: this condition is checked at the call site so won't be hit here
      var node = this.startNode();
      if (!this.state.inAsync) {
        this.unexpected();
      }
      this.next();
      if (this.match(types.star)) {
        this.raise(node.start, 'await* has been removed from the async functions proposal. Use Promise.all() instead.');
      }
      node.argument = this.parseMaybeUnary();
      return this.finishNode(node, 'AwaitExpression');
    }

    // Parses yield expression inside generator.

  }, {
    key: 'parseYield',
    value: function parseYield() {
      var node = this.startNode();

      this.next();
      if (this.match(types.semi) || !this.match(types.star) && !this.state.type.startsExpr) {
        node.delegate = false;
        node.argument = null;
      } else {
        node.delegate = this.eat(types.star);
        node.argument = this.parseMaybeAssign();
      }
      return this.finishNode(node, 'YieldExpression');
    }

    // Parse a function literal

  }, {
    key: 'parseFunction',
    value: function parseFunction(node, allowExpressionBody, isAsync, isStatement) {
      var oldInFunc = this.state.inFunction;
      var oldInMethod = this.state.inMethod;
      var oldInGenerator = this.state.inGenerator;
      var oldInClassProperty = this.state.inClassProperty;
      this.state.inFunction = true;
      this.state.inMethod = false;
      this.state.inClassProperty = false;

      this.initFunction(node, isAsync);

      this.parseFunctionMods(node);

      this.state.inGenerator = node.generator;
      if (this.match(types.name)) {
        node.id = this.parseBindingIdentifier();
      } else if (isStatement) {
        this.unexpected(null, types.name);
      }

      node.declares = isStatement;

      this.parseFunctionParams(node);
      this.parseFunctionBodyAndFinish(node, 'Function', allowExpressionBody);

      this.state.inFunction = oldInFunc;
      this.state.inMethod = oldInMethod;
      this.state.inGenerator = oldInGenerator;
      this.state.inClassProperty = oldInClassProperty;

      return node;
    }
  }, {
    key: 'parseFunctionParams',
    value: function parseFunctionParams(node, allowModifiers) {
      var oldInParameters = this.state.inParameters;
      this.state.inParameters = true;

      this.expect(types.parenL);
      node.params = this.parseBindingList(types.parenR,
      /* allowEmpty */false, allowModifiers);

      this.state.inParameters = oldInParameters;
    }
  }, {
    key: 'parseFunctionMods',
    value: function parseFunctionMods(node) {
      while (node) {
        switch (this.state.type) {
          case types.star:
            node.generator = true;
            this.next();
            break;
          case types.modulo:
            node.curried = true;
            this.next();
            break;
          default:
            return;
        }
      }
    }
  }, {
    key: 'parseMember',
    value: function parseMember() {
      var slice = this.startNode();
      var atEnd = this.eat(types.colon);
      var member = this.parseExpression();
      if (this.eat(types.colon) || atEnd) {
        slice.beginning = member;
        if (atEnd) {
          slice.finish = slice.beginning;
          slice.beginning = {
            type: 'NumericLiteral',
            value: 0
          };
        } else if (this.match(types.bracketR)) {
          slice.finish = null;
        } else {
          slice.finish = this.parseExpression();
        }
        return this.finishNode(slice, 'SliceMember');
      }
      return member;
    }
  }]);
  return ExpressionParser;
}(LValParser);

// @flow

function isNonstaticConstructor(method) {
  return !method.computed && !method.static && (method.key.name === 'constructor' || // Identifier
  method.key.value === 'constructor') // String literal
  ;
}

var StatementParser = function (_ExpressionParser) {
  inherits(StatementParser, _ExpressionParser);

  function StatementParser() {
    classCallCheck(this, StatementParser);
    return possibleConstructorReturn(this, (StatementParser.__proto__ || Object.getPrototypeOf(StatementParser)).apply(this, arguments));
  }

  createClass(StatementParser, [{
    key: 'parseTopLevel',

    // ### Statement parsing

    // Parse a program. Initializes the parser, reads any number of
    // statements, and wraps them in a Program node.  Optionally takes a
    // `program` argument.  If present, the statements will be appended
    // to its body instead of creating a new node.

    value: function parseTopLevel(file, program) {
      program.body = [];

      while (!this.match(types.eof)) {
        program.body.push(this.parseStatement());
      }

      file.program = this.finishNode(program, 'Program');
      file.comments = this.state.comments;

      if (this.options.tokens) file.tokens = this.state.tokens;

      return this.finishNode(file, 'File');
    }
  }, {
    key: 'parseStatement',
    value: function parseStatement() {
      if (this.match(types._export) || this.match(types._import)) {
        var node = this.startNode();
        var nextToken = this.lookahead();
        if (nextToken.type === types.parenL || nextToken.type === types.dot) {
          return this.parseImportMetaProperty(node); // TODO: Do acutal thing here
        }

        this.next();

        var result = void 0;
        if (this.match(types._import)) {
          result = this.parseImport(node);

          if (result.type === 'ImportDeclaration' && (!result.importKind || result.importKind === 'value')) {
            this.sawUnambiguousESM = true;
          }
        } else {
          result = this.parseExport(node);

          if (result.type === 'ExportNamedDeclaration' && (!result.exportKind || result.exportKind === 'value') || result.type === 'ExportAllDeclaration' && (!result.exportKind || result.exportKind === 'value') || result.type === 'ExportDefaultDeclaration') {
            this.sawUnambiguousESM = true;
          }
        }

        return result;
      } else if (this.match(types._function)) {
        this.next();
        return this.parseFunction(this.startNode(), false, false, true);
      } else if (this.match(types._async)) {
        this.next();
        if (!this.eat(types._function)) this.unexpected(null, types._function);
        return this.parseFunction(this.startNode(), false, true, true);
      } else if (this.match(types._class)) {
        return this.parseClass(this.startNode(), true);
      } else if (this.match(types._return)) {
        return this.parseReturn(this.startNode());
      }

      var expr = this.parseExpression(true);
      this.semicolon();
      return expr;
    }
  }, {
    key: 'parseBlock',
    value: function parseBlock(allowSingle) {
      var isArrow = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      var node = this.startNode();
      if (!this.match(types.braceL)) {
        var oldNoPipe = this.state.noPipe;
        if (isArrow) this.state.noPipe = true;
        if (!allowSingle) this.unexpected(null, types.braceL);
        node.expression = this.parseExpression();
        if (isArrow) this.state.noPipe = oldNoPipe;
        return this.finishNode(node, 'SingleExpression');
      }
      this.expect(types.braceL);
      node.body = [];
      while (!this.match(types.braceR)) {
        node.body.push(this.parseStatement());
      }
      this.expect(types.braceR);
      return this.finishNode(node, 'Block');
    }

    // Parse a class literal

  }, {
    key: 'parseClass',
    value: function parseClass(node, isStatement) {
      this.next();
      node.declares = isStatement;
      this.parseClassId(node, isStatement);
      this.parseClassSuper(node);
      this.parseClassBody(node);
      return this.finishNode(node, 'Class');
    }
  }, {
    key: 'isClassProperty',
    value: function isClassProperty() {
      return this.match(types.eq) || this.match(types.semi) || this.match(types.braceR);
    }
  }, {
    key: 'isClassMethod',
    value: function isClassMethod() {
      return this.match(types.parenL);
    }
  }, {
    key: 'parseClassBody',
    value: function parseClassBody(node) {
      // class bodies are implicitly strict
      var oldStrict = this.state.strict;
      this.state.strict = true;
      this.state.classLevel++;

      var state = { hadConstructor: false };
      var classBody = this.startNode();

      classBody.body = [];

      this.expect(types.braceL);

      while (!this.eat(types.braceR)) {
        var member = this.startNode();
        this.parseClassMember(classBody, member, state);
      }

      node.body = this.finishNode(classBody, 'ClassBody');

      this.state.classLevel--;
      this.state.strict = oldStrict;
    }
  }, {
    key: 'parseClassMember',
    value: function parseClassMember(classBody, member, state) {
      var isStatic = false;
      var containsEsc = this.state.containsEsc;


      if (this.match(types.name) && this.state.value === 'static') {
        var key = this.parseIdentifier(true); // eats 'static'

        if (this.isClassMethod()) {
          // a method named 'static'
          member.kind = 'method';
          member.computed = false;
          member.key = key;
          member.static = false;
          this.pushClassMethod(classBody, member, false, false,
          /* isConstructor */false);
          return;
        } else if (containsEsc) {
          throw this.unexpected();
        }

        // otherwise something static
        isStatic = true;
      }

      this.parseClassMemberWithIsStatic(classBody, member, state, isStatic);
    }
  }, {
    key: 'parseClassMemberWithIsStatic',
    value: function parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
      member.static = isStatic;

      if (this.eat(types.star)) {
        // a generator
        member.kind = 'method';
        this.parseClassPropertyName(member);

        if (isNonstaticConstructor(member)) {
          this.raise(member.key.start, "Constructor can't be a generator");
        }

        this.pushClassMethod(classBody, member, true, false,
        /* isConstructor */false);

        return;
      }

      var key = this.parseClassPropertyName(member);
      // Check the key is not a computed expression or string literal.
      var isSimple = key.type === 'Identifier';

      if (this.isClassMethod()) {
        member.kind = 'method';

        // a normal method
        var isConstructor = isNonstaticConstructor(member);

        if (isConstructor) {
          member.kind = 'constructor';
          state.hadConstructor = true;
        }

        this.pushClassMethod(classBody, member, false, false, isConstructor);
      } else if (isSimple && key.name === 'async' && !this.isLineTerminator()) {
        // an async method
        var isGenerator = this.match(types.star);
        if (isGenerator) {
          this.next();
        }

        member.kind = 'method';
        // The so-called parsed name would have been "async": get the real name.
        this.parseClassPropertyName(member);

        if (isNonstaticConstructor(member)) {
          this.raise(member.key.start, "Constructor can't be an async function");
        }

        this.pushClassMethod(classBody, member, isGenerator, true,
        /* isConstructor */false);
      } else if (isSimple && (key.name === 'get' || key.name === 'set') && !(this.isLineTerminator() && this.match(types.star))) {
        // `get\n*` is an uninitialized property named 'get' followed by a generator.
        // a getter or setter
        member.kind = key.name;
        // The so-called parsed name would have been "get/set": get the real name.
        this.parseClassPropertyName(member);

        if (isNonstaticConstructor(member)) {
          this.raise(member.key.start, "Constructor can't have get/set modifier");
        }
        this.pushClassMethod(classBody, member, false, false,
        /* isConstructor */false);

        this.checkGetterSetterParams(member);
      } else {
        this.unexpected();
      }
    }
  }, {
    key: 'parseClassPropertyName',
    value: function parseClassPropertyName(member) {
      var key = this.parsePropertyName(member);

      if (!member.computed && member.static && (key.name === 'prototype' || key.value === 'prototype')) {
        this.raise(key.start, 'Classes may not have static property named prototype');
      }

      return key;
    }
  }, {
    key: 'pushClassMethod',
    value: function pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
      classBody.body.push(this.parseMethod(method, isGenerator, isAsync, isConstructor, 'ClassMethod'));
    }
  }, {
    key: 'parseClassId',
    value: function parseClassId(node, requiredId) {
      if (this.match(types.name)) {
        node.id = this.parseIdentifier();
      } else if (requiredId) {
        this.unexpected(null, types.name);
      } else {
        node.id = null;
      }
    }
  }, {
    key: 'parseClassSuper',
    value: function parseClassSuper(node) {
      node.superClass = this.eat(types._extends) ? this.parseExprSubscripts() : null;
    }

    // Parses module export declaration.

  }, {
    key: 'parseExport',
    value: function parseExport(node) {
      // export * from '...'
      if (this.shouldParseExportStar()) {
        this.parseExportStar(node);
        if (node.type === 'ExportAllDeclaration') return node;
      } else if (this.isExportDefaultSpecifier()) {
        var specifier = this.startNode();
        specifier.exported = this.parseIdentifier(true);
        var specifiers = [this.finishNode(specifier, 'ExportDefaultSpecifier')];
        node.specifiers = specifiers;
        if (this.match(types.comma) && this.lookahead().type === types.star) {
          this.expect(types.comma);
          var _specifier = this.startNode();
          this.expect(types.star);
          this.expectContextual('as');
          _specifier.exported = this.parseIdentifier();
          specifiers.push(this.finishNode(_specifier, 'ExportNamespaceSpecifier'));
        } else {
          this.parseExportSpecifiersMaybe(node);
        }
        this.parseExportFrom(node, true);
      } else if (this.eat(types._default)) {
        // export default ...
        node.declaration = this.parseExportDefaultExpression();
        this.checkExport(node, true, true);
        return this.finishNode(node, 'ExportDefaultDeclaration');
      } else if (this.shouldParseExportDeclaration()) {
        if (this.match(types._async)) {
          var next = this.lookahead();

          // export async;
          if (next.type !== types._function) {
            this.unexpected(next.start, 'Unexpected token, expected "function"');
          }
        }

        node.specifiers = [];
        node.source = null;
        node.declaration = this.parseExportDeclaration(node);
      } else {
        // export { x, y as z } [from '...']
        node.declaration = null;
        node.specifiers = this.parseExportSpecifiers();
        this.parseExportFrom(node);
      }
      this.checkExport(node, true);
      return this.finishNode(node, 'ExportNamedDeclaration');
    }
  }, {
    key: 'shouldParseExportDeclaration',
    value: function shouldParseExportDeclaration() {
      return [types.const, types.var, types.let, types._function, types._class, types._async].some(this.match.bind(this));
    }
  }, {
    key: 'parseExportDefaultExpression',
    value: function parseExportDefaultExpression() {
      var expr = this.startNode();
      if (this.eat(types._function)) {
        return this.parseFunction(expr, true, false, false, true);
      } else if (this.isContextual('async') && this.lookahead().type === types._function) {
        // async function declaration
        this.eatContextual('async');
        this.eat(types._function);
        return this.parseFunction(expr, true, false, true, true);
      } else if (this.match(types._class)) {
        return this.parseClass(expr, true, true);
      } else if (this.match(types._let) || this.match(types._const) || this.match(types._var)) {
        return this.raise(this.state.start, 'Only expressions, functions or classes are allowed as the `default` export.');
      }
      var res = this.parseMaybeAssign();
      this.semicolon();
      return res;
    }

    // eslint-disable-next-line no-unused-vars

  }, {
    key: 'parseExportDeclaration',
    value: function parseExportDeclaration(node) {
      return this.parseStatement();
    }
  }, {
    key: 'isExportDefaultSpecifier',
    value: function isExportDefaultSpecifier() {
      if (this.match(types.name)) {
        return this.state.value !== 'async';
      }

      if (!this.match(types._default)) {
        return false;
      }

      var lookahead = this.lookahead();
      return lookahead.type === types.comma || lookahead.type === types.name && lookahead.value === 'from';
    }
  }, {
    key: 'parseExportSpecifiersMaybe',
    value: function parseExportSpecifiersMaybe(node) {
      if (this.eat(types.comma)) {
        node.specifiers = node.specifiers.concat(this.parseExportSpecifiers());
      }
    }
  }, {
    key: 'parseExportFrom',
    value: function parseExportFrom(node, expect) {
      if (this.eatContextual('from')) {
        node.source = this.match(types.string) ? this.parseExprAtom() : this.unexpected();
        this.checkExport(node);
      } else if (expect) {
        this.unexpected();
      } else {
        node.source = null;
      }

      this.semicolon();
    }
  }, {
    key: 'shouldParseExportStar',
    value: function shouldParseExportStar() {
      return this.match(types.star);
    }
  }, {
    key: 'parseExportStar',
    value: function parseExportStar(node) {
      this.expect(types.star);

      if (this.isContextual('as')) {
        this.parseExportNamespace(node);
      } else {
        this.parseExportFrom(node, true);
        this.finishNode(node, 'ExportAllDeclaration');
      }
    }
  }, {
    key: 'parseExportNamespace',
    value: function parseExportNamespace(node) {
      var specifier = this.startNodeAt(this.state.lastTokStart, this.state.lastTokStartLoc);

      this.next();

      specifier.exported = this.parseIdentifier(true);

      node.specifiers = [this.finishNode(specifier, 'ExportNamespaceSpecifier')];

      this.parseExportSpecifiersMaybe(node);
      this.parseExportFrom(node, true);
    }
  }, {
    key: 'checkExport',
    value: function checkExport(node, checkNames, isDefault) {
      if (checkNames) {
        // Check for duplicate exports
        if (isDefault) {
          // Default exports
          this.checkDuplicateExports(node, 'default');
        } else if (node.specifiers && node.specifiers.length) {
          // Named exports
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = node.specifiers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var specifier = _step.value;

              this.checkDuplicateExports(specifier, specifier.exported.name);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        } else if (node.declaration) {
          // Exported declarations
          if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
            var id = node.declaration.id;

            if (!id) throw new Error('Assertion failure');

            this.checkDuplicateExports(node, id.name);
          } else if (node.declaration.type === 'VariableDeclaration') {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
              for (var _iterator2 = node.declaration.declarations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var declaration = _step2.value;

                this.checkDeclaration(declaration.id);
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }
        }
      }
    }
  }, {
    key: 'checkDeclaration',
    value: function checkDeclaration(node) {
      if (node.type === 'ObjectPattern') {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = node.properties[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var prop = _step3.value;

            this.checkDeclaration(prop);
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      } else if (node.type === 'ArrayPattern') {
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = node.elements[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var elem = _step4.value;

            if (elem) {
              this.checkDeclaration(elem);
            }
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }
      } else if (node.type === 'ObjectProperty') {
        this.checkDeclaration(node.value);
      } else if (node.type === 'RestElement') {
        this.checkDeclaration(node.argument);
      } else if (node.type === 'Identifier') {
        this.checkDuplicateExports(node, node.name);
      }
    }
  }, {
    key: 'checkDuplicateExports',
    value: function checkDuplicateExports(node, name) {
      if (this.state.exportedIdentifiers.indexOf(name) > -1) {
        this.raiseDuplicateExportError(node, name);
      }
      this.state.exportedIdentifiers.push(name);
    }
  }, {
    key: 'raiseDuplicateExportError',
    value: function raiseDuplicateExportError(node, name) {
      throw this.raise(node.start, name === 'default' ? 'Only one default export allowed per module.' : '`' + name + '` has already been exported. Exported identifiers must be unique.');
    }

    // Parses a comma-separated list of module exports.

  }, {
    key: 'parseExportSpecifiers',
    value: function parseExportSpecifiers() {
      var nodes = [];
      var first = true;
      var needsFrom = void 0;

      // export { x, y as z } [from '...']
      this.expect(types.braceL);

      while (!this.eat(types.braceR)) {
        if (first) {
          first = false;
        } else {
          this.expect(types.comma);
          if (this.eat(types.braceR)) break;
        }

        var isDefault = this.match(types._default);
        if (isDefault && !needsFrom) needsFrom = true;

        var node = this.startNode();
        node.local = this.parseIdentifier(isDefault);
        node.exported = this.eatContextual('as') ? this.parseIdentifier(true) : node.local.__clone();
        nodes.push(this.finishNode(node, 'ExportSpecifier'));
      }

      // https://github.com/ember-cli/ember-cli/pull/3739
      if (needsFrom && !this.isContextual('from')) {
        this.unexpected();
      }

      return nodes;
    }

    // Parses import declaration.

  }, {
    key: 'parseImport',
    value: function parseImport(node) {
      // import '...'
      if (this.match(types.string)) {
        node.specifiers = [];
        node.source = this.parseExprAtom();
      } else {
        node.specifiers = [];
        this.parseImportSpecifiers(node);
        this.expectContextual('from');
        node.source = this.match(types.string) ? this.parseExprAtom() : this.unexpected();
      }
      this.semicolon();
      return this.finishNode(node, 'ImportDeclaration');
    }

    // eslint-disable-next-line no-unused-vars

  }, {
    key: 'shouldParseDefaultImport',
    value: function shouldParseDefaultImport(node) {
      return this.match(types.name);
    }
  }, {
    key: 'parseImportSpecifierLocal',
    value: function parseImportSpecifierLocal(node, specifier, type, contextDescription) {
      specifier.local = this.parseIdentifier();
      this.checkLVal(specifier.local, true, undefined, contextDescription);
      node.specifiers.push(this.finishNode(specifier, type));
    }

    // Parses a comma-separated list of module imports.

  }, {
    key: 'parseImportSpecifiers',
    value: function parseImportSpecifiers(node) {
      var first = true;
      if (this.shouldParseDefaultImport(node)) {
        // import defaultObj, { x, y as z } from '...'
        this.parseImportSpecifierLocal(node, this.startNode(), 'ImportDefaultSpecifier', 'default import specifier');

        if (!this.eat(types.comma)) return;
      }

      if (this.match(types.star)) {
        var specifier = this.startNode();
        this.next();
        this.expectContextual('as');

        this.parseImportSpecifierLocal(node, specifier, 'ImportNamespaceSpecifier', 'import namespace specifier');

        return;
      }

      this.expect(types.braceL);
      while (!this.eat(types.braceR)) {
        if (first) {
          first = false;
        } else {
          // Detect an attempt to deep destructure
          if (this.eat(types.colon)) {
            this.unexpected(null, 'ES2015 named imports do not destructure. ' + 'Use another statement for destructuring after the import.');
          }

          this.expect(types.comma);
          if (this.eat(types.braceR)) break;
        }

        this.parseImportSpecifier(node);
      }
    }
  }, {
    key: 'parseImportSpecifier',
    value: function parseImportSpecifier(node) {
      var specifier = this.startNode();
      specifier.imported = this.parseIdentifier(true);
      if (this.eatContextual('as')) {
        specifier.local = this.parseIdentifier();
      } else {
        this.checkReservedWord(specifier.imported.name, specifier.start, true, true);
        specifier.local = specifier.imported.__clone();
      }
      this.checkLVal(specifier.local, true, undefined, 'import specifier');
      node.specifiers.push(this.finishNode(specifier, 'ImportSpecifier'));
    }
  }]);
  return StatementParser;
}(ExpressionParser);

var Parser = function (_StatementParser) {
  inherits(Parser, _StatementParser);

  function Parser(options, input) {
    classCallCheck(this, Parser);

    options = getOptions(options);

    var _this = possibleConstructorReturn(this, (Parser.__proto__ || Object.getPrototypeOf(Parser)).call(this, options, input));

    _this.options = options;
    _this.inModule = _this.options.sourceType === 'module';
    _this.input = input;
    _this.filename = options.sourceFilename;

    // If enabled, skip leading hashbang line.
    if (_this.state.pos === 0 && _this.input[0] === '#' && _this.input[1] === '!') {
      _this.skipLineComment(2);
    }
    return _this;
  }

  createClass(Parser, [{
    key: 'parse',
    value: function parse() {
      var file = this.startNode();
      var program = this.startNode();
      this.nextToken();
      return this.parseTopLevel(file, program);
    }
  }]);
  return Parser;
}(StatementParser);

function parse(input, options) {
  var parser = new Parser(options, input);
  return parser.parse();
}

var State$1 = function () {
  function State() {
    classCallCheck(this, State);

    this.vars = [];
    this._randomVar = 'abcdoajfioaj';
  }

  createClass(State, [{
    key: 'clearVars',
    value: function clearVars() {
      this.vars.length = 0;
    }
  }, {
    key: 'addVar',
    value: function addVar(node) {
      switch (node.type) {
        case 'Identifier':
          this.vars.push(node.name);
          break;
        case 'StringLiteral':
          this.vars.push(node.value);
          break;
        default:
          this.vars.push(null);
          break;
      }
    }
  }, {
    key: 'randomVar',
    value: function randomVar() {
      this._randomVar = this._randomVar.split('').map(function (v) {
        return String.fromCharCode(v.charCodeAt(0) + 1);
      }).join('');
      return this._randomVar;
    }
  }]);
  return State;
}();

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

var STATEMENT_TYPES = ['Import*', 'Export*', 'VariableDeclaration'];

function isStatement(type) {
  return type.includes('Statement') || STATEMENT_TYPES.filter(function (s) {
    return matches(type, s);
  }).length !== 0;
}

var Base = function () {
  function Base() {
    classCallCheck(this, Base);

    this.handlers = {};
    this.state = new State$1();
  }

  createClass(Base, [{
    key: 'walk',
    value: function walk(thing) {
      var _this = this;

      var statement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      if (Array.isArray(thing)) return thing.map(function (v) {
        return _this.walk(v, statement);
      });
      if (!thing) return thing;
      var node = this.transformNode(thing);
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
  }, {
    key: 'transformNode',
    value: function transformNode(node) {
      return this.normalize(this.getTransformer(node.type)(node), node);
    }
  }, {
    key: 'getTransformer',
    value: function getTransformer(type) {
      if (typeof this[type] === 'function') {
        return this[type].bind(this);
      }
      if (this.getHandler(type)) {
        return this.getHandler(type);
      }
      throw new Error('Not found: ' + type);
      // return (_ => _);
    }
  }, {
    key: 'normalize',
    value: function normalize(thing, node) {
      if (typeof thing === 'string') {
        this.checkValidType(thing);
        node.type = thing;
        return node;
      }
      this.checkValidNode(thing);
      return thing;
    }
    /* eslint-disable class-methods-use-this */

  }, {
    key: 'clone',
    value: function clone(node) {
      return Object.assign({}, node);
    }
    /* eslint-enable */

  }, {
    key: 'iterate',
    value: function iterate(node, keys) {
      var _this2 = this;

      var type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : node.type;
      var statement = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

      var newNode = this.clone(node);
      newNode.type = type;
      keys.forEach(function (key) {
        newNode[key] = _this2.walk(node[key], statement);
      });
      return newNode;
    }
  }, {
    key: 'checkValidNode',
    value: function checkValidNode() {} // eslint-disable-line class-methods-use-this

  }, {
    key: 'checkValidType',
    value: function checkValidType() {} // eslint-disable-line class-methods-use-this

  }, {
    key: 'registerHandler',
    value: function registerHandler(matcher) {
      var func = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (node) {
        return node;
      };

      if (this.handlers[matcher]) {
        throw new Error('Duplicate Handler ' + matcher);
      }
      this.handlers[matcher] = func;
    }
  }, {
    key: 'getHandler',
    value: function getHandler(type) {
      var keys = Object.keys(this.handlers);
      var handlers = keys.filter(function (matcher) {
        return matches(type, matcher);
      });
      return this.handlers[handlers[0]];
    }
  }]);
  return Base;
}();

var POLYFILLS = {
  doWhile: {
    text: 'function do__while__(a,b){var res;do{res=b();}while(a());return res;}',
    build: function build(test, body) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'do__while__'
        },
        arguments: [{
          type: 'ArrowFunctionExpression',
          params: [],
          body: test
        }, body]
      };
    }
  },
  switch: {
    text: 'const cont__inue__={};const def__ault__={};function switch__(a,b,r,d,v){for(v of b){if(v[0]===def__ault__){d=v[1];continue;}if(v[0 ===a){r=v[1]();if(r[1] !== cont__inue__){break;}}};if(!r)r=d&&d();return r[0];}', // eslint-disable-line max-len
    build: function build(desc, cases) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'switch__'
        },
        arguments: [desc, {
          type: 'ArrayExpression',
          elements: cases
        }]
      };
    }
  },
  while: {
    text: 'function while__(a,b){var res;while(a()){res = b()}return res;}',
    build: function build(test, body) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'while__'
        },
        arguments: [{
          type: 'ArrowFunctionExpression',
          params: [],
          body: test
        }, body]
      };
    }
  },
  cond: {
    text: 'const __not__found = {};function cond__(a,b,v){var r;for(v of b){const r=v[0](a);if(r!==__not__found)return v[1](...r)}}', // eslint-disable-line
    build: function build(test, items) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'cond__'
        },
        arguments: [test, {
          type: 'ArrayExpression',
          elements: items.map(function (v) {
            return v;
          }) // TODO: Better thing
        }]
      };
    }
  },
  // HACK: Atom breaks if this isn't quoted, but eslint doesn't like it quoted
  'constructor': { // eslint-disable-line
    text: 'function constructor__(a,b){if(typeof b.is === "function")return b.is(a);return a.constructor === b;}',
    build: function build(item, constr) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'constructor__'
        },
        arguments: [item, constr]
      };
    }
  },
  curry: {
    text: 'const __ = {};let _kn=(f,n,m=(r,s)=>(...a)=>(s=r.map(v=>v===__?a.shift():v).concat(a)).length>=n?f(...s.slice(0,n+1)):m(s))=>m([]);', // eslint-disable-line
    build: function build(node, n) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: '_kn'
        },
        arguments: [node, {
          type: 'NumericLiteral',
          value: n
        }]
      };
    }
  },
  optionalCall: {
    text: 'function opt__call__(a,b){if(typeof a === "function")return a(...b);return a;}',
    build: function build(callee, args) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'opt__call__'
        },
        arguments: [callee, {
          type: 'ArrayExpression',
          elements: args
        }]
      };
    }
  },
  optionalProp: {
    text: 'function opt__prop__(a,b){if(a==null)return undefined;return a[b];}',
    build: function build(callee, arg) {
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'opt__prop__'
        },
        arguments: [callee, arg]
      };
    }
  }
};

var PolyfillTransformer = function (_BaseTransformer) {
  inherits(PolyfillTransformer, _BaseTransformer);

  function PolyfillTransformer() {
    classCallCheck(this, PolyfillTransformer);

    var _this = possibleConstructorReturn(this, (PolyfillTransformer.__proto__ || Object.getPrototypeOf(PolyfillTransformer)).call(this));

    _this.polyfills = [];
    _this.polyfillText = '';
    return _this;
  }

  createClass(PolyfillTransformer, [{
    key: 'addPolyfill',
    value: function addPolyfill(polyfill) {
      this.polyfills.push(polyfill);
      this.polyfillText += POLYFILLS[polyfill].text;
    }
  }, {
    key: 'usePolyfill',
    value: function usePolyfill(polyfill) {
      var _POLYFILLS$polyfill;

      if (!this.polyfills.includes(polyfill)) this.addPolyfill(polyfill);

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      return (_POLYFILLS$polyfill = POLYFILLS[polyfill]).build.apply(_POLYFILLS$polyfill, args);
    }
  }]);
  return PolyfillTransformer;
}(Base);

var UtilTransformer = function (_PolyfillTransformer) {
  inherits(UtilTransformer, _PolyfillTransformer);

  function UtilTransformer() {
    classCallCheck(this, UtilTransformer);
    return possibleConstructorReturn(this, (UtilTransformer.__proto__ || Object.getPrototypeOf(UtilTransformer)).apply(this, arguments));
  }

  createClass(UtilTransformer, [{
    key: 'switchCaseToFunction',
    value: function switchCaseToFunction(node) {
      return {
        type: 'ArrayExpression',
        elements: [node.test !== null ? node.test : {
          type: 'Identifier',
          name: 'def__ault__'
        }, this.blockToFunction(node.consequent, true)]
      };
    }
  }, {
    key: 'blockToFunction',
    value: function blockToFunction(node, isSwitch) {
      var bbody = node.body || node;
      var body = bbody.slice(0, -1);
      var cont = bbody.slice(-1)[0].type === 'ContinueStatement';
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
      this.insertReturn(body, function (n) {
        return isSwitch ? {
          type: 'ArrayExpression',
          elements: [n, cont ? {
            type: 'Identifier',
            name: 'cont__inue__'
          } : {
            type: 'Identifier',
            name: 'undefined'
          }]
        } : n;
      });
      return {
        type: 'FunctionExpression',
        params: [],
        body: {
          type: 'BlockStatement',
          body: body
        }
      };
    }
  }, {
    key: 'insertReturn',
    value: function insertReturn(node) {
      var _this2 = this;

      var map = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (_) {
        return _;
      };

      var body = node.body || node;
      var last = body.slice(-1)[0];
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
          node.cases.forEach(function (v) {
            return _this2.insertReturn(v, map);
          });
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
  }, {
    key: 'collectionPattern',
    value: function collectionPattern(node, collection, value) {
      var _ref;

      return _ref = {
        type: node.type
      }, defineProperty(_ref, collection, this.walk(node[collection].pattern)), defineProperty(_ref, value, {
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
      }), _ref;
    }
  }, {
    key: 'blockToFunctionBody',
    value: function blockToFunctionBody(node) {
      this.insertReturn(node);
      return node;
    }
  }, {
    key: 'keyToExpression',
    value: function keyToExpression(key, computed) {
      if (!computed) {
        return {
          type: 'StringLiteral',
          value: key.name
        };
      }
      return this.walk(key);
    }
  }]);
  return UtilTransformer;
}(PolyfillTransformer);

var MI = {
  type: 'Identifier',
  name: '_m'
};

var NF = {
  type: 'Identifier',
  name: '__not__found'
};

var Expression = function (_UtilTransformer) {
  inherits(Expression, _UtilTransformer);

  function Expression() {
    classCallCheck(this, Expression);
    return possibleConstructorReturn(this, (Expression.__proto__ || Object.getPrototypeOf(Expression)).apply(this, arguments));
  }

  createClass(Expression, [{
    key: 'If',
    value: function If(node) {
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
  }, {
    key: 'DoWhile',
    value: function DoWhile(node) {
      if (node.isStatement) return this.iterate(node, ['body, test'], 'DoWhileStatement');
      return this.usePolyfill('doWhile', this.walk(node.test), this.blockToFunction(this.walk(node.body), false));
    }
  }, {
    key: 'Class',
    value: function Class(node) {
      if (node.declares) return this.iterate(node, ['id', 'body'], 'ClassDeclaration');
      return this.iterate(node, ['id', 'body'], 'ClassExpression');
    }
  }, {
    key: 'ClassBody',
    value: function ClassBody(node) {
      return this.iterate(node, ['body']);
    }
  }, {
    key: 'ClassMethod',
    value: function ClassMethod(node) {
      return this.ObjectMethod(node);
    }
  }, {
    key: 'Function',
    value: function Function(node) {
      var newNode = this.clone(node);
      this.insertReturn(newNode.body);
      if (node.declares) return this.iterate(newNode, ['id', 'params', 'body'], 'FunctionDeclaration');
      return this.iterate(newNode, ['id', 'params', 'body'], 'FunctionExpression');
    }
  }, {
    key: 'Switch',
    value: function Switch(node) {
      if (node.isStatement) return this.iterate(node, ['discriminant', 'cases'], 'SwitchStatement');
      return this.usePolyfill('switch', this.walk(node.discriminant), this.walk(node.cases).map(this.switchCaseToFunction, this));
    }
  }, {
    key: 'SwitchCase',
    value: function SwitchCase(node) {
      var newNode = this.clone(node);
      newNode.consequent = this.walk(node.consequent.type === 'Block' ? node.consequent.body.slice() : [node.consequent.expression], true);
      return newNode;
    }
  }, {
    key: 'While',
    value: function While(node) {
      if (node.isStatement) return this.iterate(node, ['body, test'], 'WhileStatement');
      return this.usePolyfill('while', this.walk(node.test), this.blockToFunction(this.walk(node.body)));
    }
  }, {
    key: 'VariableDeclaration',
    value: function VariableDeclaration(node) {
      return this.iterate(node, ['declarations']);
    }
  }, {
    key: 'VariableDeclarator',
    value: function VariableDeclarator(node) {
      if (node.id.type === 'CollectionPattern') {
        return this.collectionPattern(node, 'id', 'init');
      }
      return this.iterate(node, ['id', 'init']);
    }
  }, {
    key: 'Program',
    value: function Program(node) {
      return this.iterate(node, ['body'], 'Program', true);
    }
  }, {
    key: 'File',
    value: function File(node) {
      return this.iterate(node, ['program']);
    }
  }, {
    key: 'SingleExpression',
    value: function SingleExpression(node) {
      return {
        type: 'BlockStatement',
        body: [this.walk(node.expression, true)]
      };
    }
  }, {
    key: 'Block',
    value: function Block(node) {
      return this.iterate(node, ['body'], 'BlockStatement', true);
    }
  }, {
    key: 'Continue',
    value: function Continue(node) {
      return this.iterate(node, [], 'ContinueStatement');
    }
  }, {
    key: 'CallExpression',
    value: function CallExpression(node) {
      var newNode = this.iterate(node, ['id', 'arguments']);
      if (newNode.blockParam) {
        newNode.arguments.push(this.walk(newNode.blockParam));
        delete newNode.blockParam;
      }
      return newNode;
    }
  }, {
    key: 'UpdateExpression',
    value: function UpdateExpression(node) {
      return this.iterate(node, ['argument']);
    }
  }, {
    key: 'AssignmentExpression',
    value: function AssignmentExpression(node) {
      if (node.right.type === 'CollectionPattern') {
        return this.collectionPattern(node, 'left', 'right');
      }
      return this.iterate(node, ['left', 'right']);
    }
  }, {
    key: 'Object',
    value: function Object(node) {
      return this.iterate(node, ['properties'], 'ObjectExpression');
    }
  }, {
    key: 'ObjectProperty',
    value: function ObjectProperty(node) {
      return this.iterate(node, ['key', 'value']);
    }
  }, {
    key: 'ObjectPattern',
    value: function ObjectPattern(node) {
      return this.iterate(node, ['properties']);
    }
  }, {
    key: 'Array',
    value: function Array(node) {
      return this.iterate(node, ['elements'], 'ArrayExpression');
    }
  }, {
    key: 'ObjectMethod',
    value: function ObjectMethod(node) {
      var newNode = this.iterate(node, ['key', 'body']);
      this.insertReturn(newNode.body);
      return newNode;
    }
  }, {
    key: 'ArrayPattern',
    value: function ArrayPattern(node) {
      return this.iterate(node, ['elements']);
    }
  }, {
    key: 'RestElement',
    value: function RestElement(node) {
      return this.iterate(node, ['argument']);
    }
  }, {
    key: 'Return',
    value: function Return(node) {
      return this.iterate(node, ['argument'], 'ReturnStatement');
    }
  }, {
    key: 'CollectionLiteral',
    value: function CollectionLiteral(node) {
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
  }, {
    key: 'CollectionPattern',
    value: function CollectionPattern(node) {
      return this.walk(node.pattern);
    }
  }, {
    key: 'MemberExpression',
    value: function MemberExpression(node) {
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
          arguments: [this.walk(node.property.beginning), this.walk(node.property.finish)]
        };
      }
      return this.iterate(node, ['object', 'property']);
    }
  }, {
    key: 'BinaryExpression',
    value: function BinaryExpression(node) {
      if (node.operator === '|>') {
        return {
          type: 'CallExpression',
          callee: this.walk(node.right),
          arguments: [this.walk(node.left)]
        };
      }
      return this.iterate(node, ['left', 'right']);
    }
  }, {
    key: 'LogicalExpression',
    value: function LogicalExpression(node) {
      return this.iterate(node, ['left', 'right']);
    }
  }, {
    key: 'UnaryExpression',
    value: function UnaryExpression(node) {
      return this.iterate(node, ['argument']);
    }
  }, {
    key: 'Cond',
    value: function Cond(node) {
      return this.usePolyfill('cond', this.walk(node.descriminent), this.walk(node.items));
    }
  }, {
    key: 'CondItem',
    value: function CondItem(node) {
      var _this2 = this;

      var newNode = {
        type: 'ArrayExpression',
        elements: [this.walk(node.matcher), {
          type: 'ArrowFunctionExpression',
          params: this.state.vars.map(function (v) {
            return v ? {
              type: 'Identifier',
              name: v
            } : {
              type: 'Identifier',
              name: _this2.state.randomVar()
            };
          }),
          body: this.blockToFunctionBody(this.walk(node.consequent))
        }]
      };
      this.state.clearVars();
      return newNode;
    }
  }, {
    key: 'CollectionMatcher',
    value: function CollectionMatcher(node) {
      var id = this.walk(node.id);
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
  }, {
    key: 'VariableMatcher',
    value: function VariableMatcher(node) {
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
  }, {
    key: 'ObjectMatcher',
    value: function ObjectMatcher(node) {
      var props = this.walk(node.props);
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
            elements: props.map(function (n) {
              return {
                type: 'CallExpression',
                callee: n,
                arguments: [MI]
              };
            })
          },
          alternate: NF
        }
      };
    }
  }, {
    key: 'ObjectMatcherProperty',
    value: function ObjectMatcherProperty(node) {
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
  }, {
    key: 'ExpressionMatcher',
    value: function ExpressionMatcher(node) {
      var expr = this.walk(node.expression);
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
  }, {
    key: 'ArrowFunction',
    value: function ArrowFunction(node) {
      var newNode = this.iterate(node, ['params', 'body'], node.kind === 'Thick' ? 'ArrowFunctionExpression' : 'FunctionExpression');
      delete newNode.kind;
      this.insertReturn(newNode.body);
      return newNode.curried ? this.usePolyfill('curry', newNode, newNode.params.length) : newNode;
    }
  }, {
    key: 'BlockParam',
    value: function BlockParam(node) {
      var newNode = this.iterate(node, ['body', 'params'], 'FunctionExpression');
      return newNode;
    }
  }, {
    key: 'OptionalCallExpression',
    value: function OptionalCallExpression(node) {
      return this.usePolyfill('optionalCall', this.walk(node.callee), this.walk(node.arguments));
    }
  }, {
    key: 'OptionalMemberExpression',
    value: function OptionalMemberExpression(node) {
      return this.usePolyfill('optionalProp', this.walk(node.object), this.keyToExpression(node.property, node.computed));
    }
  }, {
    key: 'BindExpression',
    value: function BindExpression(node) {
      if (node.object === null) {
        var callee = this.walk(node.callee);
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
          arguments: [callee.object]
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
  }]);
  return Expression;
}(UtilTransformer);

var Transformer = function (_ExpressionTransforme) {
  inherits(Transformer, _ExpressionTransforme);

  function Transformer(ast) {
    classCallCheck(this, Transformer);

    var _this = possibleConstructorReturn(this, (Transformer.__proto__ || Object.getPrototypeOf(Transformer)).call(this));

    _this.ast = ast;
    _this.registerHandler('*Literal');
    _this.registerHandler('Identifier');
    _this.registerHandler('Export*');
    _this.registerHandler('Import*');
    return _this;
  }

  createClass(Transformer, [{
    key: 'transform',
    value: function transform() {
      return this.transformNode(this.ast);
    }
  }]);
  return Transformer;
}(Expression);

function transform(ast) {
  var transformer = new Transformer(ast);
  return transformer.transform();
}

var generate = require('@babel/generator').default;

function index (code) {
  var transformer = new Transformer(parse(code));
  var result = generate(transformer.transform());
  var str = transformer.polyfillText + '\n' + result.code;
  return str;
}

exports.default = index;
exports.parse = parse;
exports.transform = transform;
exports.generate = generate;
