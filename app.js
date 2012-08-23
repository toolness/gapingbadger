var fs = require('fs'),
    crypto = require('crypto'),
    express = require('express'),
    bic = require('browserid-cors')(),
    app = express.createServer();

var DATA_DIR = __dirname + '/data',
    ASSERTIONS_DIR = DATA_DIR + '/assertions',
    USERS_DIR = DATA_DIR + '/users',
    BLOBS_DIR = DATA_DIR + '/blobs',
    PORT = 3031;

var assertionFilename = app.assertionFilename = function(id) {
  return ASSERTIONS_DIR + '/' + id + '.json';
}

function userFilename(email) {
  return USERS_DIR + '/' + email;
}

function blobFilename(email) {
  return BLOBS_DIR + '/' + email;
}

function writeJSON(filename, obj) {
  fs.writeFileSync(filename, JSON.stringify(obj));
}

var readJSON = app.readJSON = function(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf-8'));
}

function idIsValid(req, res, next) {
  var id = parseInt(req.params.id);
  if (isNaN(id) || id < 0)
    return res.send(404);
  if (!fs.existsSync(assertionFilename(id)))
    return res.send(404);
  req.params.id = id;
  next();
}

app.makeSalt = function() {
  return Math.random().toString();
};

app.getLatestAssertionId = function(files) {
  var maxNum = 0;
  files.forEach(function(filename) {
    var match = filename.match(/^([0-9]+)\.json/);
    if (match) {
      var num = parseInt(match[1]);
      if (num > maxNum)
        maxNum = num;
    }
  });
  return maxNum;
};

app.setAssertionIdsForUser = function(email, ids) {
  writeJSON(userFilename(email), ids);
};

app.getAssertionIdsForUser = function(email) {
  var filename = userFilename(email);
  if (!fs.existsSync(filename))
    return [];
  return readJSON(filename);
};

app.setBlobForUser = function(email, blob) {
  writeJSON(blobFilename(email), blob);
};

app.getBlobForUser = function(email) {
  var filename = blobFilename(email);
  if (!fs.existsSync(filename))
    return {};
  return readJSON(filename);
};

app.deleteUser = function(email) {
  app.getAssertionIdsForUser(email).forEach(function(id) {
    fs.unlinkSync(assertionFilename(id));
  });
  app.setAssertionIdsForUser(email, []);
  app.setBlobForUser(email, {});
};

app.addAssertionForUser = function(email, assertion) {
  var newId = app.nextId++;
  var ids = app.getAssertionIdsForUser(email);
  assertion.id = newId;
  writeJSON(assertionFilename(newId), assertion);
  ids.push(newId);
  app.setAssertionIdsForUser(email, ids);
  return newId;
};

[DATA_DIR, ASSERTIONS_DIR, USERS_DIR, BLOBS_DIR].forEach(function(dirname) {
  if (!fs.existsSync(dirname)) {
    console.log("creating " + dirname);
    fs.mkdirSync(dirname);
  }
});


app.browserIDCORS = bic;
app.nextId = app.getLatestAssertionId(fs.readdirSync(ASSERTIONS_DIR)) + 1;

if (!module.parent)
  app.use(express.logger());

app.use(express.limit(1024 * 50));
app.use(express.bodyParser());
app.use(bic.accessToken);
app.use(bic.fullCORS);

app.post('/token', bic.handleTokenRequest);

app.get('/badges', bic.requireAccessToken, function(req, res) {
  var ids = app.getAssertionIdsForUser(req.user.email);
  res.send(ids.map(function(id) {
    return readJSON(assertionFilename(id));
  }));
});

app.get('/blob', bic.requireAccessToken, function(req, res) {
  res.send(app.getBlobForUser(req.user.email));
});

app.put('/blob', bic.requireAccessToken, function(req, res) {
  if (typeof(req.body) != 'object')
    return res.send(400);
  app.setBlobForUser(req.user.email, req.body);
  res.send();
});

app.get('/badges/:id', idIsValid, function(req, res) {
  return res.send(readJSON(assertionFilename(req.params.id)));
});

app.del('/badges/:id', bic.requireAccessToken, idIsValid, function(req, res) {
  var ids = app.getAssertionIdsForUser(req.user.email);
  var index = ids.indexOf(req.params.id);
  if (index == -1)
    return res.send(403);
  ids.splice(index, 1);
  app.setAssertionIdsForUser(req.user.email, ids);
  fs.unlinkSync(assertionFilename(req.params.id));
  return res.send();
});

app.post('/badges', bic.requireAccessToken, function(req, res) {
  if (typeof(req.body) != "object")
    return res.send(400);

  var assertion = req.body;
  var salt = app.makeSalt();
  var sha256 = crypto.createHash('sha256');

  sha256.update(req.user.email + salt, 'utf8');
  assertion.recipient = "sha256$" + sha256.digest('hex');
  assertion.salt = salt;
  
  var id = app.addAssertionForUser(req.user.email, assertion);
  assertion.id = id;
  return res.send(assertion);
});

module.exports = app;

if (!module.parent)
  app.listen(PORT, function() {
    console.log('listening on port ' + PORT);
  });
