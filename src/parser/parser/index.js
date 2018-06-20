import { getOptions } from '../options';
import StatementParser from './statement';

export default class Parser extends StatementParser {
  constructor(options, input) {
    options = getOptions(options);
    super(options, input);

    this.options = options;
    this.inModule = this.options.sourceType === 'module';
    this.input = input;
    this.filename = options.sourceFilename;

    // If enabled, skip leading hashbang line.
    if (
      this.state.pos === 0 &&
      this.input[0] === '#' &&
      this.input[1] === '!'
    ) {
      this.skipLineComment(2);
    }
  }

  parse() {
    const file = this.startNode();
    const program = this.startNode();
    this.nextToken();
    return this.parseTopLevel(file, program);
  }
}
