var EJS = require("ejs");
var Util = require("util");
var STATUS_CODES = require("http").STATUS_CODES;

var defaultTemplatePath = Path.resolve(__dirname, "../view/error.ejs");
var defaultTemplate = EJS.compile(FS.readFileSync(defaultTemplatePath, "utf8"), {
  filename: defaultTemplatePath
});

var ErrorHandler = module.exports = function(options) {
  options = options || {};

  var useViews = !!options.views;
  var template = options.template || "error.ejs";

  return function(err, req, res, next) {
    if (typeof err === "number") err = new HTTPError(err);
    if (options.console) {
      console.error(err.toString());
      if (err.stack) console.log(err.stack);
    }

    var name = err.name || "ServerError";
    var status = err.status || err.statusCode || 500;

    res.status(status);

    // Render HTML error page
    if (req.accepts("html")) {
      if (useViews) return res.render(template, {
        error: err,
        options: options
      });

      res.type("html");
      return res.send(defaultTemplate({
        error: err,
        options: options
      }));
    }

    // Format JSON
    if (req.accepts("json")) {
      var json = {
        status: status,
        error: name,
        message: err.message || "A server error has occured"
      };
      if (options.stack) json.stack = err.stack;
      if (err.detail) json.detail = err.detail;
      return res.json(json);
    }

    // Plain Text
    res.send(err.name + ": " + err.message + (options.stack ? "\n" + err.stack : ""));
  };
};

var HTTPError = ErrorHandler.HTTPError = function(status, detail) {
  if (!(this instanceof HTTPError)) return new HTTPError(status, detail);
  Error.call(this);
  this.name = "HTTPError";
  this.status = status || 500;
  this.detail = detail;
};
Util.inherits(HTTPError, Error);

Object.defineProperty(HTTPError.prototype, "message", {
  enumerable: true,
  get: function() {
    return this.status + ": " + STATUS_CODES[this.status];
  }
});

HTTPError.prototype.toString = function() {
  return "[" + this.name + "] " + this.message;
};

var DoesNotExist = ErrorHandler.DoesNotExist = function(entity, id) {
  if (!(this instanceof DoesNotExist)) return new DoesNotExist(entity, id);
  HTTPError.call(this, 404, {
    entity: entity,
    id: id
  });
  this.name = "DoesNotExist";
};
Util.inherits(DoesNotExist, HTTPError);

var Conflict = ErrorHandler.Conflict = function(message, detail) {
  if (!(this instanceof Conflict)) return new Conflict(message, detail);
  detail.message = message;
  HTTPError.call(this, 409, detail);
  this.name = "Conflict";
};
Util.inherits(Conflict, HTTPError);
