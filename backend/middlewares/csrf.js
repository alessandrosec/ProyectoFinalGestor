const crypto = require('crypto');

function generateCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrfToken(req, res, next) {
  const tokenFromForm = req.body._csrf;
  if (tokenFromForm !== req.session.csrfToken) {
    return res.status(403).send('CSRF token inválido o ausente');
  }
  next();
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken
};
