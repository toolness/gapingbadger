define(function(require) {
  var MicroEvent = require("gb/micro-event"),
      BrowserIDCORS = require("gb/browserid-cors"),
      Badges = require("gb/badges");
  
  return function Gapingbadger(options) {
    var bic = BrowserIDCORS({
      baseURL: options.baseURL,
      cacheKey: 'gapingbadger_' + options.baseURL
    });
    var badges = Badges(bic);
    var self = {
      baseURL: options.baseURL,
      email: null,
      badgesRead: 0,
      badges: []
    };

    if (bic.isLoggedIn())
      self.email = bic.getLoginInfo().email;

    self.updateBadgesRead = function() {
      self.badgesRead = self.badges.length;
      badges.setBadgesRead(self.badgesRead);
    };
    
    self.fetch = function() {
      badges.getBadgesRead(function(err, badgesRead) {
        if (err) {
          if (err.status == 403) {
            return self.trigger('auth-required');
          } else
            return self.trigger('error', 'getBadgesRead() -> ' + err.status);
        }
        self.badgesRead = badgesRead;
        badges.fetch(function(err, badgeList) {
          if (err)
            return self.trigger('error', 'error while fetching badges: ' +
                                req.status);
          self.badges = badgeList;
          self.trigger('fetch', self.badges);
        });
      });
    }
    
    self.logout = bic.logout;

    self.authenticate = function(assertion) {
      if (!assertion)
        return;
      bic.processAssertion(assertion, function(err, info) {
        if (err)
          return self.trigger('error', 'error authenticating: ' + req.status);
        self.email = info.email;
        self.trigger('authenticate');
        self.fetch();
      });
    };

    self.award = function(badgeAssertion, cb) {
      badges.award(badgeAssertion, function(err, badge) {
        if (err) {
          self.trigger('error', 'error awarding badge: ' + req.status);
          if (cb)
            cb(req);
          return;
        }
        self.badges.push(badge);
        self.trigger('award', badge);
        if (cb)
          cb(null, badge);
      });
    };
    
    MicroEvent.mixin(self);
    return self;
  };
});
