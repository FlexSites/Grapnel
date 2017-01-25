const pug = require('pug');
const fs = require('fs');

/**
 * pages: [Page]
 * resources: ResourceMap
 */
function pugRender(pages, resources) {
  const _readFileSync = fs.readFileSync;

  const page = pages[0].content;

  pages = pages.reduce((prev, curr) => {
    prev[curr.id] = curr.content;
    return prev;
  }, {});


  fs.readFileSync = (...args) => {
    const path = args[0].replace(/\.pug$/, '');
    const file = pages[path];

    console.log(path, file, pages);

    if (file) {
      return file;
    }

    return _readFileSync.apply(fs, args);
  };

  const result = pug.render(page, Object.assign({ pretty: true, filename: 'thing.pug' }, resources));

  fs.readFileSync = _readFileSync;

  return result;
}

// const layout = `
// html
//   head
//     title My Site - #{title}
//     block scripts
//       script(src='/jquery.js')
//   body
//     block content
//     block foot
//       #footer
//         p some footer content
// `;

// const item = `
// extends layout

// block scripts
//   script(src='/jquery.js')
//   script(src='/pets.js')

// block content
//   h1= title
//   - var pets = ['cat', 'dog']
// `;

// const results = pugRender([{
//   id: 'page',
//   content: item,
// }, {
//   id: 'layout',
//   content: layout,
// }], { title: 'my fancy title' });

// console.log('RESULT', results);

module.exports = pugRender;
