'use strict';

const AWS = require('aws-sdk');
const Bluebird = require('bluebird');
const dynamo = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });

// Renderers
const pug = require('pug');
const hogan = require('hogan.js');
const ejs = require('ejs');
const lodash = require('lodash.template');

const renderers = {
  pug: (page, data) => {
    return pug.compile(page)(data);
  },
  hogan: (page, data) => {
    return hogan.compile(page).render(data);
  },
  ejs: (page, data) => {
    return ejs.render(page, data);
  },
  lodash: (page, data) => {
    return lodash(page)(data);
  },
};

module.exports.handler = (event, context, cb) => {
  getTemplate(event.pathParameters, event.headers.Host)
    .then((template) => {
      const render = renderers[template.page.type];

      const dataSources = Object.keys(template.data).map((key) => {
        const request = template.data[key];

        request.key = key;

        return request;
      });

      return Bluebird.props({
        page: fetchPage(template.page),
        data: fetchAllData(dataSources),
      })
      .then((results) => {
        return render(results.page, results.data);
      });
    })
    .catch(cb);
};

class Render {
  constructor(uri, domain) {
    this.uri = uri;
    this.domain = domain;
    this.errors = [];

    this.meta = this.loadMeta(uri, domain);
    this.data = this.loadData(this.meta);
    this.page = this.loadPage(this.meta);
  }

  loadMeta() {
    return dynamo.get({
      TableName: 'Table',
      Key: {
        path: this.uri,
        domain: this.domain,
      },
    })
      .promise()
      .then((item) => {
        return item;
      })
      .catch((ex) => {
        cb(ex);
      });
  }

  loadData(metaPromise) {
    return metaPromise
      .then((meta) => {

      })
  }
}

function fetchAllData(requests) {
  const errors = [];

  return Bluebird.all(
    requests
      .map(fetchData)
      .map((result) => {
        const succeeded = result.isFufilled();

        if (succeeded) {
          return {
            key: result.key,
            data: result.value(),
          };
        }

        const error = result.reason();

        errors.push(error);

        return {
          key: result.key,
          data: null,
          error,
        };
      })
  )
    .then((results) => {
      const data = results.reduce((prev, curr) => {
        prev[curr.key] = curr.data;

        return prev;
      }, {});

      data.__errors = errors;

      return data;
    });
}

function fetchData(request) {
  return Bluebird.props({
    key: request.key,
    data: Bluebird.resolve(axios.request(request)).reflect(),
  });
}

function fetchPage(request) {
  return Bluebird.props({
    key: request.key,
    data: Bluebird.resolve(axios.request(request)).reflect(),
  });
}


const item = {
  path: '/event/:id',
  domain: 'site.com',
  data: {
    data: {
      url: 'http://api.com/event/:id',
      method: 'POST',
      body: {
        query: '{ event { id } }',
        variables: { id },
      },
      querystring: { cache: false },
      headers: {

      },
    },
  },
  page: {
    type: 'pug|lodash|hogan|ejs',
    url: 's3://my/key/${ path }',
    method: 'GET',
    querystring: { cache: false },
  },
  cache: 10000,
};
