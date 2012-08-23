var fs = require('fs'),
    express = require('express'),
    bic = require('browserid-cors')(),
    app = express.createServer();

var DATA_DIR = __dirname + '/data',
    ASSERTIONS_DIR = DATA_DIR + '/assertions',
    USERS_DIR = DATA_DIR + '/users',
    PORT = 3000;

var assertionFilename = app.assertionFilename = function(id) {
  return ASSERTIONS_DIR + '/' + id + '.json';
}

function userFilename(email) {
  return USERS_DIR + '/' + email;
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

app.deleteUser = function(email) {
  app.getAssertionIdsForUser(email).forEach(function(id) {
    fs.unlinkSync(assertionFilename(id));
  });
  app.setAssertionIdsForUser(email, []);
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

app.browserIDCORS = bic;

[DATA_DIR, ASSERTIONS_DIR, USERS_DIR].forEach(function(dirname) {
  if (!fs.existsSync(dirname)) {
    console.log("creating " + dirname);
    fs.mkdirSync(dirname);
  }
});

app.nextId = app.getLatestAssertionId(fs.readdirSync(ASSERTIONS_DIR)) + 1;

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
  var id = app.addAssertionForUser(req.user.email, req.body);
  return res.send({id: id});
});

module.exports = app;

if (!module.parent)
  app.listen(PORT, function() {
    console.log('listening on port ' + PORT);
  });