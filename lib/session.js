var Cookies = require("cookies");
var Path = require("path");
var Util = require("util");
var UUID = require("libuuid");

/* Check if the request path is a child of base
 *  e.g. relative(/foo, /foo/bar) == bar (OK), whereas
 *  relative(/foo, /baz) == ../baz (BAD)
 */
function includesPath(base, check) {
  return Path.relative(base, check).slice(0, 2) !== "..";
}

function noop() {}

/**
 * Don't bork if a callback isn't provided
 */
function callsafe() {
  var args = Array.apply(Array, arguments);
  var callback = args.shift();

  if (callback instanceof Function)
    callback.apply(null, args);
}

/**
 * Session Entity
 */
var Session = module.exports = function(store) {
  this._store = store;
  this.id = UUID.create();

  this.reset();
};

Session.prototype.reset = function(destroy) {
  this._destroyed = !! destroy;
  this.mtime = 0;

  this.token = null;
  this.user = null;
};

Session.prototype.save = function(callback) {
  this.mtime = new Date();
  this._store.set(this, callback);
};

Session.prototype.destroy = function(callback) {
  this.reset(true);
  this._store.del(this.id, callback);
};

Session.prototype.toJSON = function() {
  var json = {};
  var session = this;

  Object.keys(session).forEach(function(key) {
    if (key[0] === "_") return; // Private attributes
    json[key] = session[key];
  });

  return json;
};

// Find or Create a session for the request
function setup(options, req, next) {
  if (req.session) return next(); // Session has already been set up
  var id = req.cookies.get(options.cookie_name);

  options.store.get(id, function(err, session) {
    if (err) return next(err);
    if (!session) session = new Session(options.store);

    req.session = session;
    req.cookies.set(options.cookie_name, session.id, {
      maxage: options.maxage * 60000
    });

    next(null, session);
  });
}

// Detect un-authenitcated requests
function enforce(options, req, next) {
  if (req.session.token) return next(null, true);

  // Allow some paths to process w/o session auth
  if (includesPath(options.authorize_path, req.url)) return next(null, true);
  for (var i = 0; i < options.allow_paths.length; i++) {
    if (includesPath(options.allow_paths[i], req.url)) return next(null, true);
  }

  // Fail
  next(null, false);
}

function express(options) {
  options = options || {};
  options.__proto__ = config; // jshint ignore:line

  function handle(req, res, next) {
    req.cookies = new Cookies(req, res);

    setup(options, req, function(err, session) {
      if (err) return next(err);
      res.locals.session = session;

      // Save session document at the end of the transaction
      res.on("finish", function() {
        if (!session._destroyed) session.save();
      });

      // Redirect to authorize endpoint
      enforce(options, req, function(err, allow) {
        if (err) return next(err);
        if (!allow) {
          req.session.redirect_uri = req.url;
          return res.redirect(options.authorize_path);
        }

        next();
      });
    });
  }

  return handle;
}

function io(options) {
  options = options || {};
  options.__proto__ = config; // jshint ignore:line

  function handle(socket, next) {
    // Hack Cookies into behaving itself
    socket.request.cookies = new Cookies(socket.request, {
      getHeader: noop,
      setHeader: noop
    });

    setup(options, socket.request, function(err, session) {
      if (err) return next(err);

      enforce(options, socket.request, function(err, allow) {
        if (err) return next(err);
        if (!allow) return next(new Error("Session is not authenticated"));
        next();
      });
    });
  }

  return handle;
}

Session.express = express;
Session.io = io;

/**
 * In-Memory Session Store and prototype for persistent
 * session storage modules
 */
var MemStore = Session.Store = function() {
  this.entities = {};
};

// Start the Reaper
MemStore.prototype.startReaper = function() {
  setImmediate(reaper.bind(this));
};

/**
 * Enqueue a reap task `config.reap_interval` seconds in the future.
 * -> Allows the reap_interval to be changed.
 * -> Set `config.reap_interval` to 0 to kill reaper loop
 */
function reaper() {
  if (config.reap_interval < 1) return; // Disable reaping
  var store = this;

  setTimeout(function() {
    store.reap();
    reaper.call(store); // Next reaping
  }, config.reap_interval * 1000);
}

MemStore.prototype.get = function(id, callback) {
  if (!id) return callback(null, false);
  callback(null, this.entities[id]);
};

MemStore.prototype.set = function(entity, callback) {
  this.entities[entity.id] = entity;
  callsafe(callback, null, entity);
};

MemStore.prototype.del = function(id, callback) {
  callsafe(callback, null, (delete this.entities[id]));
};

MemStore.prototype.reap = function() {
  var store = this;
  var horizon = new Date(Date.now() - config.maxage * 1000 * 60);

  Object.keys(store.entities).forEach(function(id) {
    if (store.entities[id].mtime < horizon) store.del(id);
  });
};

/**
 * Session Configuration
 */
var config = {
  cookie_name: "Session-ID",
  store: new MemStore(),
  maxage: 60, // Minutes
  reap_interval: 60, // Seconds
  authorize_path: "/authorize",
  allow_paths: []
};

Session.set = function(key, value) {
  return (config[key] = value);
};
Session.get = function(key) {
  return config[key];
};
