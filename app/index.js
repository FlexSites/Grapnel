'use strict';

const express = require('express');

const siteController = require('./controllers/site');
const errorController = require('./controllers/error');
const renderController = require('./controllers/render');

const PORT = process.env.PORT || 3000;

const app = express();

app.use('/site', siteController);

app.use(renderController);

app.use(errorController);

app.listen(PORT, () => {
  console.info(`Listening on port ${ PORT }`);
});
