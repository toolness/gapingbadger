var expect = require('expect.js'),
    request = require('supertest'),
    fs = require('fs'),
    app = require('../app');

describe("getLatestAssertionId", function() {
  it("should return 0 if no files are present", function() {
    expect(app.getLatestAssertionId([])).to.be(0);
  });
  
  it("should return > 0 if some files are present", function() {
    expect(app.getLatestAssertionId(['5.json', '1.json'])).to.be(5);
  });
  
  it("should ignore non-numeric JSON files", function() {
    expect(app.getLatestAssertionId(['blop', '1.json'])).to.be(1);
  });
});

describe("server", function() {
  beforeEach(function() {
    app.deleteUser('foo@foo.org');
    app.deleteUser('otherperson@foo.org');
  });

  afterEach(function() {
    app.deleteUser('foo@foo.org');
    app.deleteUser('otherperson@foo.org');
  });
  
  app.browserIDCORS.tokenStorage.setTestingToken('abcd', {
    email: 'foo@foo.org',
    origin: 'http://bar.org'
  });

  it('should reject GET /badges when unauthenticated', function(done) {
    request(app)
      .get('/badges')
      .expect(403, done);
  });

  it('should accept GET /badges', function(done) {
    var id = app.addAssertionForUser('foo@foo.org', {evidence: "u"});
    request(app)
      .get('/badges')
      .set('X-Access-Token', 'abcd')
      .expect(200, [{
        id: id,
        evidence: "u"
      }], done);
  });

  it('should return 404 for GET /badges/-1', function(done) {
    request(app)
      .get('/badges/-1')
      .expect(404, done);
  });

  it('should return 404 for GET /badges/blarg', function(done) {
    request(app)
      .get('/badges/blarg')
      .expect(404, done);
  });

  it('should return 404 for GET /badges/9999999999', function(done) {
    request(app)
      .get('/badges/9999999999')
      .expect(404, done);
  });

  it('should accept GET /badges/n', function(done) {
    var id = app.addAssertionForUser('foo@foo.org', {evidence: "hi"});
    request(app)
      .get('/badges/' + id)
      .expect(200, {
        id: id,
        evidence: "hi"
      }, done);
  });

  it('should reject DELETE /badges/n when unauthenticated', function(done) {
    request(app)
      .del('/badges/1')
      .expect(403, done);
  });
  
  it('should accept DELETE /badges/n', function(done) {
    var id = app.addAssertionForUser('foo@foo.org', {evidence: "hi"});
    request(app)
      .del('/badges/' + id)
      .set('X-Access-Token', 'abcd')
      .expect(204, function(err) {
        if (err) return done(err);
        expect(app.getAssertionIdsForUser('foo@foo.org')).to.eql([]);
        expect(fs.existsSync(app.assertionFilename(id))).to.not.be.ok();
        done();
      });
  });

  it('should reject DELETE /badges/n when not owner', function(done) {
    var id = app.addAssertionForUser('otherperson@foo.org', {evidence: "hi"});
    request(app)
      .del('/badges/' + id)
      .set('X-Access-Token', 'abcd')
      .expect(403, done);
  });

  it('should reject POST /badges when unauthenticated', function(done) {
    request(app)
      .post('/badges')
      .expect(403, done);
  });
  
  it('should accept POST /badges', function(done) {
    request(app)
      .post('/badges')
      .set('X-Access-Token', 'abcd')
      .send({
        foo: 'bar'
      })
      .expect(200, function(err, res) {
        if (err) return done(err);
        var id = res.body.id;
        expect(app.getAssertionIdsForUser('foo@foo.org')).to.eql([id]);
        expect(app.readJSON(app.assertionFilename(id))).to.eql({
          id: id,
          foo: 'bar'
        });
        expect(app.nextId).to.be(id + 1);
        done();
      });
  });
});
