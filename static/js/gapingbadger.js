define(function(require) {
  var MicroEvent = require("micro-event"),
      BrowserIDCORS = require("gb/browserid-cors"),
      Badges = require("gb/badges"),
      checkLogin = require("gb/check-login"),
      nullCb = function() {};
  
  return function Gapingbadger(options) {
    if (typeof(options) == "string")
      options = {baseURL: options};
    
    var bic = BrowserIDCORS({
      baseURL: options.baseURL,
      cacheKey: 'gapingbadger_' + options.baseURL
    });
    var badges = Badges(bic);
    var badgesRead = 0;
    var self = {
      baseURL: options.baseURL,
      email: null,
      unreadBadges: 0,
      badges: []
    };

    if (bic.isLoggedIn())
      self.email = bic.getLoginInfo().email;

    function updateUnreadBadges() {
      var count = 0;
      for (var i = 0; i < self.badges.length; i++) {
        console.log('COMPARE', self.badges[i].id, badgesRead);
        if (self.badges[i].id > badgesRead)
          count++;
      }
      if (count != self.unreadBadges) {
        self.unreadBadges = count;
        self.triggerChange('unreadBadges');
      }
    }
    
    function onBadgesChanged() {
      updateUnreadBadges();
      self.triggerChange('badges');
    }
    
    self.markAllBadgesRead = function() {
      var maxId = 0;
      if (self.badges.length)
        maxId = self.badges[self.badges.length-1].id;
      badgesRead = maxId;
      badges.setBadgesRead(badgesRead);
      updateUnreadBadges();
    };
    
    self.fetch = function() {
      badges.getBadgesRead(function(err, maxId) {
        if (err)
          return self.trigger('error', 'getBadgesRead() -> ' + err.status);
        badgesRead = maxId;
        updateUnreadBadges();
        badges.fetch(function(err, badgeList) {
          var badgesChanged = false;
          if (err)
            return self.trigger('error', 'error while fetching badges: ' +
                                req.status);
          if (badgeList.length == self.badges.length) {
            for (var i = 0; i < badgeList.length; i++)
              if (badgeList[i].id != self.badges[i].id) {
                badgesChanged = true;
                break;
              }
          } else
            badgesChanged = true;
          if (badgesChanged) {
            self.badges = badgeList;
            onBadgesChanged();
          }
        });
      });
    }
    
    self.triggerChange = function() {
      self.trigger('change');
      for (var i = 0; i < arguments.length; i++)
        self.trigger('change:' + arguments[i]);
    };
    
    self.logout = function() {
      self.email = null;
      if (self.badges.length) {
        self.badges.splice(0);
        onBadgesChanged();
      }
      bic.logout();
    };
    
    self.checkLogin = function(options) {
      checkLogin({
        browserIDCORS: bic,
        authenticate: options.authenticate,
        success: function() {
          self.email = bic.getLoginInfo().email;
          options.success();
        },
        error: function(req) {
          self.trigger('error', 'error authenticating: ' + req.status);
        }
      });
    };
    
    self.disown = function(badgeAssertion, cb) {
      cb = cb || nullCb;
      badges.disown(badgeAssertion, function(err) {
        if (err) return cb(err);
        var index = self.badges.indexOf(badgeAssertion);
        if (index != -1) {
          self.badges.splice(index, 1);
          onBadgesChanged();
        }
        cb(null);
      });
    };
    
    self.award = function(badgeAssertion, cb) {
      if (!badgeAssertion.badge)
        badgeAssertion = {badge: badgeAssertion};
      if (!badgeAssertion.badge.version)
        badgeAssertion.badge.version = "0.5.0";
      if (!badgeAssertion.badge.issuer)
        badgeAssertion.badge.issuer = {};
      badgeAssertion.badge.issuer.origin = self.baseURL;
      badgeAssertion.badge.issuer.name = "Gapingbadger";
      cb = cb || nullCb;
      badges.award(badgeAssertion, function(err, badge) {
        if (err) {
          self.trigger('error', 'error awarding badge: ' + req.status);
          return cb(req);
        }
        self.badges.push(badge);
        onBadgesChanged();
        self.trigger('award', badge);
        cb(null, badge);
      });
    };
    
    MicroEvent.mixin(self);
    return self;
  };
});
