// @flow

import { types as tt } from '../tokenizer/types';
import ExpressionParser from './expression';

function isNonstaticConstructor(method) {
  return (
    !method.computed &&
      !method.static &&
      (method.key.name === 'constructor' || // Identifier
        method.key.value === 'constructor') // String literal
  );
}

export default class StatementParser extends ExpressionParser {
  // ### Statement parsing

  // Parse a program. Initializes the parser, reads any number of
  // statements, and wraps them in a Program node.  Optionally takes a
  // `program` argument.  If present, the statements will be appended
  // to its body instead of creating a new node.

  parseTopLevel(file, program) {
    program.body = [];

    while (!this.match(tt.eof)) {
      program.body.push(this.parseStatement());
    }

    file.program = this.finishNode(program, 'Program');
    file.comments = this.state.comments;

    if (this.options.tokens) file.tokens = this.state.tokens;

    return this.finishNode(file, 'File');
  }

  parseStatement() {
    if (this.match(tt._export) || this.match(tt._import)) {
      const node = this.startNode();
      const nextToken = this.lookahead();
      if (nextToken.type === tt.parenL || nextToken.type === tt.dot) {
        return this.parseImportMetaProperty(node); // TODO: Do acutal thing here
      }

      this.next();

      let result;
      if (this.match(tt._import)) {
        result = this.parseImport(node);

        if (
          result.type === 'ImportDeclaration' &&
            (!result.importKind || result.importKind === 'value')
        ) {
          this.sawUnambiguousESM = true;
        }
      } else {
        result = this.parseExport(node);

        if (
          (result.type === 'ExportNamedDeclaration' &&
              (!result.exportKind || result.exportKind === 'value')) ||
            (result.type === 'ExportAllDeclaration' &&
              (!result.exportKind || result.exportKind === 'value')) ||
            result.type === 'ExportDefaultDeclaration'
        ) {
          this.sawUnambiguousESM = true;
        }
      }

      return result;
    } else if (this.match(tt._function)) {
      this.next();
      return this.parseFunction(this.startNode(), false, false, true);
    } else if (this.match(tt._async)) {
      this.next();
      if (!this.eat(tt._function)) this.unexpected(null, tt._function);
      return this.parseFunction(this.startNode(), false, true, true);
    } else if (this.match(tt._class)) {
      return this.parseClass(this.startNode(), true);
    } else if (this.match(tt._return)) {
      return this.parseReturn(this.startNode());
    }

    const expr = this.parseExpression(true);
    this.semicolon();
    return expr;
  }

  parseBlock(allowSingle, isArrow = false) {
    const node = this.startNode();
    if (!this.match(tt.braceL)) {
      const oldNoPipe = this.state.noPipe;
      if (isArrow) this.state.noPipe = true;
      if (!allowSingle) this.unexpected(null, tt.braceL);
      node.expression = this.parseExpression();
      if (isArrow) this.state.noPipe = oldNoPipe;
      return this.finishNode(node, 'SingleExpression');
    }
    this.expect(tt.braceL);
    node.body = [];
    while (!this.match(tt.braceR)) {
      node.body.push(this.parseStatement());
    }
    this.expect(tt.braceR);
    return this.finishNode(node, 'Block');
  }

  // Parse a class literal

  parseClass(node, isStatement) {
    this.next();
    node.declares = isStatement;
    this.parseClassId(node, isStatement);
    this.parseClassSuper(node);
    this.parseClassBody(node);
    return this.finishNode(
      node,
      'Class'
    );
  }

  isClassProperty() {
    return this.match(tt.eq) || this.match(tt.semi) || this.match(tt.braceR);
  }

  isClassMethod() {
    return this.match(tt.parenL);
  }

  parseClassBody(node) {
    // class bodies are implicitly strict
    const oldStrict = this.state.strict;
    this.state.strict = true;
    this.state.classLevel++;

    const state = { hadConstructor: false };
    const classBody = this.startNode();

    classBody.body = [];

    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      const member = this.startNode();
      this.parseClassMember(classBody, member, state);
    }

    node.body = this.finishNode(classBody, 'ClassBody');

    this.state.classLevel--;
    this.state.strict = oldStrict;
  }

  parseClassMember(classBody, member, state) {
    let isStatic = false;
    const { containsEsc } = this.state;

    if (this.match(tt.name) && this.state.value === 'static') {
      const key = this.parseIdentifier(true); // eats 'static'

      if (this.isClassMethod()) {
        // a method named 'static'
        member.kind = 'method';
        member.computed = false;
        member.key = key;
        member.static = false;
        this.pushClassMethod(
          classBody,
          member,
          false,
          false,
          /* isConstructor */ false,
        );
        return;
      } else if (containsEsc) {
        throw this.unexpected();
      }

      // otherwise something static
      isStatic = true;
    }

    this.parseClassMemberWithIsStatic(classBody, member, state, isStatic);
  }

  parseClassMemberWithIsStatic(classBody, member, state, isStatic) {
    member.static = isStatic;

    if (this.eat(tt.star)) {
      // a generator
      member.kind = 'method';
      this.parseClassPropertyName(member);

      if (isNonstaticConstructor(member)) {
        this.raise(member.key.start, "Constructor can't be a generator");
      }

      this.pushClassMethod(
        classBody,
        member,
        true,
        false,
        /* isConstructor */ false,
      );

      return;
    }

    const key = this.parseClassPropertyName(member);
    // Check the key is not a computed expression or string literal.
    const isSimple = key.type === 'Identifier';

    if (this.isClassMethod()) {
      member.kind = 'method';

      // a normal method
      const isConstructor = isNonstaticConstructor(member);

      if (isConstructor) {
        member.kind = 'constructor';
        state.hadConstructor = true;
      }

      this.pushClassMethod(
        classBody,
        member,
        false,
        false,
        isConstructor,
      );
    } else if (isSimple && key.name === 'async' && !this.isLineTerminator()) {
      // an async method
      const isGenerator = this.match(tt.star);
      if (isGenerator) {
        this.next();
      }

      member.kind = 'method';
      // The so-called parsed name would have been "async": get the real name.
      this.parseClassPropertyName(member);

      if (isNonstaticConstructor(member)) {
        this.raise(
          member.key.start,
          "Constructor can't be an async function",
        );
      }

      this.pushClassMethod(
        classBody,
        member,
        isGenerator,
        true,
        /* isConstructor */ false,
      );
    } else if (
      isSimple &&
      (key.name === 'get' || key.name === 'set') &&
      !(this.isLineTerminator() && this.match(tt.star))
    ) {
      // `get\n*` is an uninitialized property named 'get' followed by a generator.
      // a getter or setter
      member.kind = key.name;
      // The so-called parsed name would have been "get/set": get the real name.
      this.parseClassPropertyName(member);

      if (isNonstaticConstructor(member)) {
        this.raise(
          member.key.start,
          "Constructor can't have get/set modifier",
        );
      }
      this.pushClassMethod(
        classBody,
        member,
        false,
        false,
        /* isConstructor */ false,
      );

      this.checkGetterSetterParams(member);
    } else {
      this.unexpected();
    }
  }

  parseClassPropertyName(member) {
    const key = this.parsePropertyName(member);

    if (
      !member.computed &&
      member.static &&
      (key.name === 'prototype' ||
        key.value === 'prototype')
    ) {
      this.raise(
        key.start,
        'Classes may not have static property named prototype',
      );
    }

    return key;
  }

  pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor) {
    classBody.body.push(this.parseMethod(
      method,
      isGenerator,
      isAsync,
      isConstructor,
      'ClassMethod',
    ));
  }

  parseClassId(node, requiredId) {
    if (this.match(tt.name)) {
      node.id = this.parseIdentifier();
    } else if (requiredId) {
      this.unexpected(null, tt.name);
    } else {
      node.id = null;
    }
  }

  parseClassSuper(node) {
    node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
  }

  // Parses module export declaration.

  parseExport(node) {
    // export * from '...'
    if (this.shouldParseExportStar()) {
      this.parseExportStar(node);
      if (node.type === 'ExportAllDeclaration') return node;
    } else if (this.isExportDefaultSpecifier()) {
      const specifier = this.startNode();
      specifier.exported = this.parseIdentifier(true);
      const specifiers = [this.finishNode(specifier, 'ExportDefaultSpecifier')];
      node.specifiers = specifiers;
      if (this.match(tt.comma) && this.lookahead().type === tt.star) {
        this.expect(tt.comma);
        const specifier = this.startNode();
        this.expect(tt.star);
        this.expectContextual('as');
        specifier.exported = this.parseIdentifier();
        specifiers.push(this.finishNode(specifier, 'ExportNamespaceSpecifier'));
      } else {
        this.parseExportSpecifiersMaybe(node);
      }
      this.parseExportFrom(node, true);
    } else if (this.eat(tt._default)) {
      // export default ...
      node.declaration = this.parseExportDefaultExpression();
      this.checkExport(node, true, true);
      return this.finishNode(node, 'ExportDefaultDeclaration');
    } else if (this.shouldParseExportDeclaration()) {
      if (this.match(tt._async)) {
        const next = this.lookahead();

        // export async;
        if (next.type !== tt._function) {
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

  shouldParseExportDeclaration() {
    return [
      tt.const, tt.var, tt.let,
      tt._function, tt._class, tt._async
    ].some(this.match.bind(this));
  }

  parseExportDefaultExpression() {
    const expr = this.startNode();
    if (this.eat(tt._function)) {
      return this.parseFunction(expr, true, false, false, true);
    } else if (
      this.isContextual('async') &&
      this.lookahead().type === tt._function
    ) {
      // async function declaration
      this.eatContextual('async');
      this.eat(tt._function);
      return this.parseFunction(expr, true, false, true, true);
    } else if (this.match(tt._class)) {
      return this.parseClass(expr, true, true);
    } else if (
      this.match(tt._let) ||
      this.match(tt._const) ||
      this.match(tt._var)
    ) {
      return this.raise(
        this.state.start,
        'Only expressions, functions or classes are allowed as the `default` export.',
      );
    }
    const res = this.parseMaybeAssign();
    this.semicolon();
    return res;
  }

  // eslint-disable-next-line no-unused-vars
  parseExportDeclaration(node) {
    return this.parseStatement();
  }

  isExportDefaultSpecifier() {
    if (this.match(tt.name)) {
      return this.state.value !== 'async';
    }

    if (!this.match(tt._default)) {
      return false;
    }

    const lookahead = this.lookahead();
    return (
      lookahead.type === tt.comma ||
      (lookahead.type === tt.name && lookahead.value === 'from')
    );
  }

  parseExportSpecifiersMaybe(node) {
    if (this.eat(tt.comma)) {
      node.specifiers = node.specifiers.concat(this.parseExportSpecifiers());
    }
  }

  parseExportFrom(node, expect) {
    if (this.eatContextual('from')) {
      node.source = this.match(tt.string)
        ? this.parseExprAtom()
        : this.unexpected();
      this.checkExport(node);
    } else if (expect) {
      this.unexpected();
    } else {
      node.source = null;
    }

    this.semicolon();
  }

  shouldParseExportStar() {
    return this.match(tt.star);
  }

  parseExportStar(node) {
    this.expect(tt.star);

    if (this.isContextual('as')) {
      this.parseExportNamespace(node);
    } else {
      this.parseExportFrom(node, true);
      this.finishNode(node, 'ExportAllDeclaration');
    }
  }

  parseExportNamespace(node) {
    const specifier = this.startNodeAt(
      this.state.lastTokStart,
      this.state.lastTokStartLoc,
    );

    this.next();

    specifier.exported = this.parseIdentifier(true);

    node.specifiers = [this.finishNode(specifier, 'ExportNamespaceSpecifier')];

    this.parseExportSpecifiersMaybe(node);
    this.parseExportFrom(node, true);
  }

  checkExport(node, checkNames, isDefault) {
    if (checkNames) {
      // Check for duplicate exports
      if (isDefault) {
        // Default exports
        this.checkDuplicateExports(node, 'default');
      } else if (node.specifiers && node.specifiers.length) {
        // Named exports
        for (const specifier of node.specifiers) {
          this.checkDuplicateExports(specifier, specifier.exported.name);
        }
      } else if (node.declaration) {
        // Exported declarations
        if (
          node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration'
        ) {
          const { id } = node.declaration;
          if (!id) throw new Error('Assertion failure');

          this.checkDuplicateExports(node, id.name);
        } else if (node.declaration.type === 'VariableDeclaration') {
          for (const declaration of node.declaration.declarations) {
            this.checkDeclaration(declaration.id);
          }
        }
      }
    }
  }

  checkDeclaration(node) {
    if (node.type === 'ObjectPattern') {
      for (const prop of node.properties) {
        this.checkDeclaration(prop);
      }
    } else if (node.type === 'ArrayPattern') {
      for (const elem of node.elements) {
        if (elem) {
          this.checkDeclaration(elem);
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

  checkDuplicateExports(node, name) {
    if (this.state.exportedIdentifiers.indexOf(name) > -1) {
      this.raiseDuplicateExportError(node, name);
    }
    this.state.exportedIdentifiers.push(name);
  }

  raiseDuplicateExportError(node, name) {
    throw this.raise(
      node.start,
      name === 'default'
        ? 'Only one default export allowed per module.'
        : `\`${name}\` has already been exported. Exported identifiers must be unique.`,
    );
  }

  // Parses a comma-separated list of module exports.

  parseExportSpecifiers() {
    const nodes = [];
    let first = true;
    let needsFrom;

    // export { x, y as z } [from '...']
    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      const isDefault = this.match(tt._default);
      if (isDefault && !needsFrom) needsFrom = true;

      const node = this.startNode();
      node.local = this.parseIdentifier(isDefault);
      node.exported = this.eatContextual('as')
        ? this.parseIdentifier(true)
        : node.local.__clone();
      nodes.push(this.finishNode(node, 'ExportSpecifier'));
    }

    // https://github.com/ember-cli/ember-cli/pull/3739
    if (needsFrom && !this.isContextual('from')) {
      this.unexpected();
    }

    return nodes;
  }

  // Parses import declaration.

  parseImport(node) {
    // import '...'
    if (this.match(tt.string)) {
      node.specifiers = [];
      node.source = this.parseExprAtom();
    } else {
      node.specifiers = [];
      this.parseImportSpecifiers(node);
      this.expectContextual('from');
      node.source = this.match(tt.string)
        ? this.parseExprAtom()
        : this.unexpected();
    }
    this.semicolon();
    return this.finishNode(node, 'ImportDeclaration');
  }

  // eslint-disable-next-line no-unused-vars
  shouldParseDefaultImport(node) {
    return this.match(tt.name);
  }

  parseImportSpecifierLocal(node, specifier, type, contextDescription) {
    specifier.local = this.parseIdentifier();
    this.checkLVal(specifier.local, true, undefined, contextDescription);
    node.specifiers.push(this.finishNode(specifier, type));
  }

  // Parses a comma-separated list of module imports.
  parseImportSpecifiers(node) {
    let first = true;
    if (this.shouldParseDefaultImport(node)) {
      // import defaultObj, { x, y as z } from '...'
      this.parseImportSpecifierLocal(
        node,
        this.startNode(),
        'ImportDefaultSpecifier',
        'default import specifier',
      );

      if (!this.eat(tt.comma)) return;
    }

    if (this.match(tt.star)) {
      const specifier = this.startNode();
      this.next();
      this.expectContextual('as');

      this.parseImportSpecifierLocal(
        node,
        specifier,
        'ImportNamespaceSpecifier',
        'import namespace specifier',
      );

      return;
    }

    this.expect(tt.braceL);
    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        // Detect an attempt to deep destructure
        if (this.eat(tt.colon)) {
          this.unexpected(
            null,
            'ES2015 named imports do not destructure. ' +
              'Use another statement for destructuring after the import.',
          );
        }

        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      this.parseImportSpecifier(node);
    }
  }

  parseImportSpecifier(node) {
    const specifier = this.startNode();
    specifier.imported = this.parseIdentifier(true);
    if (this.eatContextual('as')) {
      specifier.local = this.parseIdentifier();
    } else {
      this.checkReservedWord(
        specifier.imported.name,
        specifier.start,
        true,
        true,
      );
      specifier.local = specifier.imported.__clone();
    }
    this.checkLVal(specifier.local, true, undefined, 'import specifier');
    node.specifiers.push(this.finishNode(specifier, 'ImportSpecifier'));
  }
}
