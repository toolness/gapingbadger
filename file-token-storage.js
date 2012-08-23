var fs = require('fs'),
    tokens = require('browserid-cors/lib/tokens');

module.exports = function(options) {
  var tokenLength = options.tokenLength || 40;
  var dirname = options.dir;

  function tokenFile(token) {
    return dirname + '/' + token;
  }
  
  function tokenExists(token) {
    return token.match(/[A-Za-z0-9]+/) && fs.existsSync(tokenFile(token));
  }
  
  function readToken(token) {
    return JSON.parse(fs.readFileSync(tokenFile(token), 'utf8'));
  }
  
  function writeToken(token, info) {
    fs.writeFileSync(tokenFile(token), JSON.stringify(info));
  }
  
  if (!dirname || !fs.existsSync(dirname))
    throw new Error("token dir does not exist: " + dirname);

  return {
    createToken: function(info, cb) {
      tokens.findUniqueRandomString(tokenLength, function(token, retry) {
        if (!token)
          return cb('cannot generate random string');
        if (tokenExists(token))
          return retry();
        writeToken(token, info);
        cb(null, token);
      });
    },
    getTokenInfo: function(token, cb) {
      if (!tokenExists(token))
        return cb(null, null);
      cb(null, readToken(token));
    },
    deleteToken: function(token) {
      if (tokenExists(token))
        fs.unlinkSync(tokenFile(token));
    },
    setTestingToken: function(token, info) {
      writeToken(token, info);
    },
  };
};
