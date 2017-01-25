const pug = require('pug');
const fs = require('fs');

const _readFile = fs.readFileSync;

const layout = `
html
  head
    title My Site - #{title}
    block scripts
      script(src='/jquery.js')
  body
    block content
    block foot
      #footer
        p some footer content
`;

const item = `
extends layout

block scripts
  script(src='/jquery.js')
  script(src='/pets.js')

block content
  h1= title
  - var pets = ['cat', 'dog']
`;

fs.readFileSync = (...args) => {
  console.log('ARGS', args);
  if (args[0] === 'layout.pug') {
    return layout
  }
  return _readFile.apply(fs, args);
}

console.log('stuff', pug.render(item, { pretty: true, filename: 'thing.pug', title: 'my pug' }));
