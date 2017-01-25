const admin = require('firebase-admin');

const credential = admin.credential.cert(require('../../firebase-credentials.json'));

admin.initializeApp({
  credential,
  databaseURL: 'https://graphql-render.firebaseio.com/',
});

module.exports = admin.database();
