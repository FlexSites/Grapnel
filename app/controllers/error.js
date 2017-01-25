

module.exports = (err, req, res, next) => {
  console.error('Error happened', err);
  next();
}
