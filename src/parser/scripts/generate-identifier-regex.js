/* eslint-disable import/no-dynamic-require */
// Which Unicode version should be used?
const version = '10.0.0';


function search(arr, ch, starting) {
  for (let i = starting; arr[i] <= ch && i < arr.length; last = i++) {
    if (arr[i] === ch) return i;
  }
  return -1;
}

const start = require(`unicode-${
  version
}/Binary_Property/ID_Start/code-points.js`).filter((ch) => ch > 0x7f);
let last = -1;
const cont = [0x200c, 0x200d].concat(require(`unicode-${
  version
}/Binary_Property/ID_Continue/code-points.js`).filter((ch) => ch > 0x7f && search(start, ch, last + 1) === -1));

function pad(str, width) {
  while (str.length < width) str = `0${str}`;
  return str;
}

function esc(code) {
  const hex = code.toString(16);
  if (hex.length <= 2) return `\\x${pad(hex, 2)}`;
  return `\\u${pad(hex, 4)}`;
}

function generate(chars) {
  const astral = [];
  let re = '';
  for (let i = 0, at = 0x10000; i < chars.length; i++) {
    const from = chars[i];
    let to = from;
    while (i < chars.length - 1 && chars[i + 1] === to + 1) {
      i++;
      to++;
    }
    if (to <= 0xffff) {
      if (from === to) re += esc(from);
      else if (from + 1 === to) re += esc(from) + esc(to);
      else re += `${esc(from)}-${esc(to)}`;
    } else {
      astral.push(from - at, to - from);
      at = to;
    }
  }
  return { nonASCII: re, astral };
}

const startData = generate(start);
const contData = generate(cont);

process.stdout.write(`let nonASCIIidentifierStartChars = "${startData.nonASCII}";\n`);
process.stdout.write(`let nonASCIIidentifierChars = "${contData.nonASCII}";\n`);
process.stdout.write(`const astralIdentifierStartCodes = ${JSON.stringify(startData.astral)};`);
process.stdout.write(`const astralIdentifierCodes = ${JSON.stringify(contData.astral)};\n`);
