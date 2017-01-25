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
const firebase = require('../lib/firebase');

function getFirebaseData(key) {
  const timeKey = `firebase: ${ key }`;

  console.time(timeKey);

  return Bluebird.resolve(
    firebase
      .ref(key)
      .once('value')
      .then((snapshot) => {
        console.timeEnd(timeKey);

        return snapshot.val();
      })
  );
}

function getTemplate(domain, requestPath = '/') {
  domain = encode(domain);
  requestPath = encode(requestPath || '/');

  return Bluebird.all([
    getFirebaseData(`${ domain }/paths/${ requestPath }`),
    getFirebaseData(`${ domain }/resources`),
  ])
    .spread((request, resources) => {
      request.data = Object.keys(request.data).reduce((prev, curr) => {
        const key = request.data[curr];

        // console.log(data.resources, key);
        const val = get(resources, key, {});

        prev[curr] = val;

        return prev;
      }, {});

      return Bluebird.resolve(request);
    });
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

module.exports = (domain, url) => {
  return getTemplate(domain, url)
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

        // console.log('WHAT', results.page);


        // const etag = combineEtag(Object.assign({ __page: results.page.data }, results.data ));
        // console.log('ETAG', etag);

        console.time('render');
        const html = render(results.page.data, results.data);

        console.timeEnd('render');
        return html;
      });
    });
};

// function combineEtag(resources) {
//   console.log('RESOURCES', Object.keys(resources));
//   return Object.keys(resources).map((key) => {
//     const resource = resources[key];
//     console.log(key, resource);
//     const tag = resource.etag;

//     console.log('etag', key, tag);

//     return tag;
//   }).join('|')
// }



function fetchAllData(requests) {
  const errors = [];

  return Bluebird.all(
    requests
      .map(fetch)
  )
    .then((results) => {
      const data = results.reduce((prev, curr) => {
        prev[curr.key] = curr.data;

        return prev;
      }, {});

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
    });
}

// console.time('total');
// module.exports.handler(require('./event.json'), {}, (err, data) => {
//   console.log(err, data);
//   console.timeEnd('total');
// })


// const item = {
//   path: '/event/:id',
//   domain: 'site.com',
//   data: {
//     data: {
//       url: 'http://api.com/event/:id',
//       method: 'POST',
//       body: {
//         query: '{ event { id } }',
//         variables: { id: '1234' },
//       },
//       querystring: { cache: false },
//       headers: {

//       },
//     },
//   },
//   page: {
//     type: 'pug|lodash|hogan|ejs',
//     url: 's3://my/key/${ path }',
//     method: 'GET',
//     querystring: { cache: false },
//   },
//   cache: 10000,
// };

function encode(str) {
  return encodeURIComponent(str).replace(/\./g, '%2E');
}

// console.log(JSON.stringify({
//   [encode("www.wiseguyscomedy.com")]: {
//     "resources": {
//       "event": {
//         "list": {
//           "url": "http://www.wiseguyscomedy.com/api",
//           "method": "GET"
//         }
//       }
//     },
//     "paths": {
//       [encode("/")]: {
//         "data": {
//           "events": "event.list"
//         },
//         "page": {
//           "type": "pug",
//           "url": "http://localhost:8080/wiseguyscomedy.pug",
//           "method": "GET"
//         },
//         "cache": 10000
//       }
//     }
//   }
// }, null, 2));
