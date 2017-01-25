'use strict';

const render = require('../lib/render');

module.exports = (req, res, next) => {
  render('www.wiseguyscomedy.com' || req.get('host'), req.url)
    .then(res.send.bind(res))
    .catch(next);
};
