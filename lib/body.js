var QS = require("qs");

/**
 * Request body handling Middleware
 * I love you https://github.com/expressjs/body-parser, but you just don't do
 * what I need...
 */
exports.reader = function(options) {
  options = options || {};
  var limit = options.limit || 1024000; // Default 100kB

  function handle(req, res, next) {
    var chunks = [];
    var received = 0;
    req.on("data", function(chunk) {
      // Enforce body length limit
      received += chunk.length;
      if (received > limit) return res.send(413);

      chunks.push(chunk);
    });

    req.on("end", function() {
      req.raw = Buffer.concat(chunks, req.get("content-length"));
      next();
    });
  }

  return handle;
};

exports.json = function(options) {
  options = options || {};

  function handle(req, res, next) {
    if (!req.raw) return next();
    if (!req.is("json")) return next();

    try {
      req.body = JSON.parse(req.raw.toString("utf8"));
      next();
    } catch (e) {
      next(e);
    }
  }

  return handle;
};

exports.urlencoded = function(options) {
  options = options || {};

  function handle(req, res, next) {
    if (!req.raw) return next();
    if (!req.is("urlencoded")) return next();

    try {
      req.body = QS.parse(req.raw.toString("utf8"));
      next();
    } catch (e) {
      next(e);
    }
  }

  return handle;
};
