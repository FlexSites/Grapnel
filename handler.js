'use strict';

const AWS = require('aws-sdk');
const Bluebird = require('bluebird');
const dynamo = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
const get = require('lodash.get');
const axios = require('axios');
const etag = require('etag');

// Renderers
const pug = require('pug');
const hogan = require('hogan.js');
const ejs = require('ejs');
const lodash = require('lodash.template');

function getTemplate(requestPath, domain) {
  const data = require('./schema.json')[domain];
  requestPath = !!requestPath ? requestPath : '/';

  const request = data.paths[requestPath];

  request.data = Object.keys(request.data).reduce((prev, curr) => {
    const key = request.data[curr];

    // console.log(data.resources, key);
    const val = get(data.resources, key, {});

    prev[curr] = val;

    return prev;
  }, {});

  // console.log(request);


  return Bluebird.resolve(request);
}

// POST /trigger

// [
//   { "event": "1234" },
//   { "event": "5678" }
// ]

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
  getTemplate(event.pathParameters.proxy, event.headers.Host)
    .then((template) => {

      // console.log('template', template);

      const render = renderers[template.page.type];

      const dataSources = Object.keys(template.data).map((key) => {
        const request = template.data[key];

        request.key = key;

        return request;
      });

      template.page.key = 'page';

      return Bluebird.props({
        page: fetch(template.page),
        data: fetchAllData(dataSources),
      })
      .then((results) => {

        console.log('WHAT', results.page);


        const etag = combineEtag(Object.assign({ __page: results.page.data }, results.data ));
        console.log('ETAG', etag);

        console.time('render');
        const html = render(results.page.data, results.data);

        console.timeEnd('render');
        return html;
      })
      .then((html) => {
        // console.log('HTML-----------------');
        // console.log(html);
        cb(null, html);
      })
    })
    .catch(cb);
};

function combineEtag(resources) {
  console.log('RESOURCES', Object.keys(resources));
  return Object.keys(resources).map((key) => {
    const resource = resources[key];
    console.log(key, resource);
    const tag = resource.etag;

    console.log('etag', key, tag);

    return tag;
  }).join('|')
}

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
      .map(fetch)
  )
    .then((results) => {
      return results.map((result) => {
        const succeeded = result.isFulfilled();


        if (succeeded) {
          // console.log('succeeded', result.value())
          return {
            key: result.key,
            data: result.value(),
          };
        }

        const error = result.reason();

        // console.log('error', error);

        errors.push(error);

        return {
          key: result.key,
          data: null,
          error,
        };
      });
    })
    .then((results) => {
      const data = results.reduce((prev, curr) => {
        prev[curr.key] = curr.data;

        return prev;
      }, {});

      data.__errors = errors;

      return data;
    })
    .catch(ex => {
      console.error('errro', ex);
    })
}

function fetch(request) {
  console.time(request.key);

  return Bluebird.resolve(
    axios.request(request)
  )
    .then((results) => {
      console.timeEnd(request.key);

      return {
        key: request.key,
        data: results.data,
        etag: etag(typeof results.data !== 'string' ? JSON.stringify(results.data) : results.data),
      };
    })
    .reflect();
}

console.time('total');
module.exports.handler(require('./event.json'), {}, (err, data) => {
  console.log(err, data);
  console.timeEnd('total');
})


const item = {
  path: '/event/:id',
  domain: 'site.com',
  data: {
    data: {
      url: 'http://api.com/event/:id',
      method: 'POST',
      body: {
        query: '{ event { id } }',
        variables: { id: '1234' },
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
