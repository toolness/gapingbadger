define(function(require) {
  var MicroEvent = require("gb/micro-event"),
      BrowserIDCORS = require("gb/browserid-cors");
  
  return function Gapingbadger(options) {
    var bic = BrowserIDCORS({
      baseURL: options.baseURL,
      cacheKey: 'gapingbadger_' + options.baseURL
    });
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
      bic.ajax({
        type: 'PUT',
        url: "/blob",
        contentType: 'application/json',
        data: JSON.stringify({badgesRead: self.badgesRead})
      });
    };
    
    self.fetch = function() {
      bic.ajax({
        url: "/blob",
        success: function(data) {
          if (typeof(data) == "string")
            data = JSON.parse(data);
          self.badgesRead = data.badgesRead || 0;
          bic.ajax({
            url: "/badges",
            success: function(data) {
              if (typeof(data) == "string")
                data = JSON.parse(data);
              self.badges = data;
              self.trigger('fetch', self.badges);
            },
            error: function(req) {
              self.trigger('error', 'error while fetching badges: ' +
                           req.status);
            }
          });
        },
        error: function(req) {
          if (req.status == 403) {
            self.trigger('auth-required');
          } else
            self.trigger('error', 'error while fetching blob: ' + req.status);
        }
      });
    };
    
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
      bic.ajax({
        type: "POST",
        url: "/badges",
        contentType: 'application/json',
        data: JSON.stringify(badgeAssertion),
        success: function(data) {
          self.badges.push(data);
          self.trigger('award', data);
          if (cb)
            cb(null, data);
        },
        error: function(req) {
          self.trigger('error', 'error awarding badge: ' + req.status);
          if (cb)
            cb(req);
        }
      });
    };
    
    MicroEvent.mixin(self);
    return self;
  };
});
