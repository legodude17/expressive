export default class State {
  constructor() {
    this.vars = [];
    this._randomVar = 'abcdoajfioaj';
  }
  clearVars() {
    this.vars.length = 0;
  }
  addVar(node) {
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
  randomVar() {
    this._randomVar = this._randomVar.split('').map(v => String.fromCharCode(v.charCodeAt(0) + 1)).join('');
    return this._randomVar;
  }
}
