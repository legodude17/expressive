import repl from 'repl';
import vm from 'vm';
import fs from 'fs';
import expressive from './index';

const read = path => new Promise((res, rej) => fs.readFile(path, 'utf8', (err, data) => {
  if (err) return rej(err);
  return res(data);
}));

const write = (path, data) => new Promise((res, rej) => fs.readFile(path, data, err => {
  if (err) return rej(err);
  return res();
}));

const file = process.argv[2];
const out = process.argv[3];

function valuate(cmd, context, filename, cb) {
  try {
    const newCode = expressive(cmd);
    const result = vm.runInContext(newCode, context);
    cb(null, result);
  } catch (e) {
    if (/Unexpected token, expected ";" at 'undefined'/.test(e.message)) {
      cmd += ';';
      valuate(cmd, context, filename, cb);
    } else if (/Unexpected end of input|Unexpected token/.test(e.message)) {
      cb(new repl.Recoverable(e));
    } else {
      cb(e);
    }
  }
}

if (file) {
  process.stderr.write(`Compiling of ${file} started\n`);
  read(file)
    .then(code => expressive(code))
    .then(newCode => (out ? write(out, newCode) :
      process.stdout.write(`${newCode.trim()}\n`)))
    .then(() => {
      process.stderr.write('Compilation complete\n');
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`Error occured: ${err}\n`);
      process.exit(1);
    });
} else {
  repl.start({
    prompt: '> ',
    eval: valuate
  });
}
