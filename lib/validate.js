/* jshint esnext: true, -W103, -W083 */
/**
 * A validate-able Object
 */
var Net = require("net");
var Util = require("util");
var Validator = module.exports = function() {};
Validator.prototype.assert = function(param, check, expect) {
  var value = traverse.call(this, param);

  if (value === undefined) throw ValidationError(param, expect, undefined);
  if (check(value)) return value;

  // Traverse arrays transparently
  if (value instanceof Array) {
    for (var i = 0; i < value.length; i++)
      if (!check(value[i])) throw ValidationError(param + "." + i, expect, value[i]);
    return value;
  }

  // Not an array or a valid value
  throw ValidationError(param, expect, value);
};

Validator.prototype.assertWithDefault = function(param, check, defaultValue) {
  var value = traverse.call(this, param);
  if (value === undefined || !check(value)) return traverse.call(this, param, defaultValue);

  return value;
};

const M_DOT = /\./;

function traverse(path, value) {
  var nodes = path instanceof Array ? path : path.split(M_DOT);
  var last = nodes.pop();
  var length = nodes.length;

  var node = this;
  for (var i = 0; i < length; i++) {
    if (node[nodes[i]] === undefined) {
      if (value === undefined) return undefined;
      node = node[nodes[i]] = {}; // Populate object path for setter
    }
    node = node[nodes[i]];
  }

  if (value === undefined) return node[last];
  return (node[last] = value); // Setter
}

/**
 * Validation
 */
function isDefined(value) {
  return true;
}
Validator.prototype.isDefined = function(param, defaultValue) {
  if (defaultValue === undefined) return this.assert(param, isDefined, param + " to be defined");
  return this.assertWithDefault(param, isDefined, defaultValue);
};

function isString(value) {
  return (typeof value === "string" || value instanceof String) && value.length;
}
Validator.prototype.isString = function(param, defaultValue) {
  console.log("Am I a String?!?!");
  if (defaultValue === undefined) return this.assert(param, isString, param + " to be a non-empty string");
  return this.assertWithDefault(param, isString, defaultValue);
};

// NOTE This test is naive in that it doesn't actually validate padding
const M_BASE64 = /^[a-z0-9+\/]+={0,2}$/i;
function isBase64(value) {
  return isString(value) && M_BASE64.test(value);
}
Validator.prototype.isBase64 = function(param) {
  return this.assert(param, isBase64, param + " to be a base64-encoded string");
};

function isNumber(value) {
  return !isNaN(+value);
}
Validator.prototype.isNumber = function(param, defaultValue) {
  if (defaultValue === undefined) return this.assert(param, isNumber, param + " to be a number");
  return this.assertWithDefault(param, isNumber, +defaultValue);
};

function isBoolean(value) {
  return (typeof value === "boolean" || value instanceof Boolean);
}
Validator.prototype.isBoolean = function(param, defaultValue) {
  if (defaultValue === undefined) return this.assert(param, isBoolean, param + " to be a boolean");
  return this.assertWithDefault(param, isBoolean, !!defaultValue);
};

function isArray(value) {
  return (value instanceof Array && value.length);
}
Validator.prototype.isArray = function(param, defaultValue) {
  if (defaultValue === undefined) return this.assert(param, isArray, param + " to be an object");
  return this.assertWithDefault(param, isArray, defaultValue);
};

function isObject(value) {
  return (typeof value === "object" && value !== null);
}
Validator.prototype.isObject = function(param, defaultValue) {
  if (defaultValue === undefined) return this.assert(param, isObject, param + " to be an object");
  return this.assertWithDefault(param, isObject, defaultValue);
};

const M_FQDN = /^[a-z0-9\-_]{1,255}$/i;

function isFQDN(value, expr) {
  if (!isString(value)) return false; // Must be a string

  var labels = value.split(M_DOT);
  if (!labels.length) return false; // Must have at least one label

  if (labels[labels.length - 1] === "") labels.pop(); // Ignore trailing `.`

  expr = expr || M_FQDN;
  for (var i = 0; i < labels.length; i++)
    if (!expr.test(labels[i])) return false; // Check label character-set
  return true;
}
Validator.prototype.isFQDN = function(param) {
  return this.assert(param, isFQDN, param + " to be an FQDN");
};

const M_HOSTNAME = /^[a-z0-9][a-z0-9\-]{0,62}$/i;

function isHostname(value) {
  return isFQDN(value, M_HOSTNAME);
}
Validator.prototype.isHostname = function(param) {
  return this.assert(param, isHostname, param + " to be a valid hostname");
};

Validator.prototype.isIPv4 = function(param) {
  return this.assert(param, Net.isIPv4, param + " to be a valid IPv4 address");
};

Validator.prototype.isIPv6 = function(param) {
  return this.assert(param, Net.isIPv6, param + " to be a valid IPv6 address");
};

/**
 * Type Coercion
 */
Validator.prototype.coerce = function(param, handle) {
  var value = traverse.call(this, param);
  return traverse.call(this, param, handle(value));
};

function toArray(value) {
  if (value === undefined) return [];
  return value instanceof Array ? value : [value];
}
Validator.prototype.toArray = function(param) {
  return this.coerce(param, toArray);
};

function toNumber(value) {
  return +value || 0;
}
Validator.prototype.toNumber = function(param) {
  return this.coerce(param, toNumber);
};

// Strings that should evaluate to false
var falsy = ["false", "n", "no", "0", "null", "nil"];
Validator.prototype.toBoolean = function(param) {
  var value = traverse.call(this, param);

  if (falsy.indexOf(value) > -1) return traverse.call(this, param, false);
  return traverse.call(this, param, !!value);
};

Validator.prototype.trim = function(param, fields) {
  var value = this.isObject(param);
  var keys = Object.keys(value);

  // Remove extra fields
  for (var i = 0; i < keys.length; i++)
    if (fields.indexOf(keys[i]) < 0) delete value[keys[i]];

  return value;
};

/**
 * Validation Error
 */
var ValidationError = Validator.ValidationError = function(param, expect, value) {
  if (!(this instanceof ValidationError)) return new ValidationError(param, expect, value);

  // Error
  Error.call(this);
  this.name = "ValidationError";

  // Validation Parameters
  this.param = param;
  this.value = value;
  this.expect = expect;

  // Express help
  this.statusCode = this.status = 400;
};
Util.inherits(ValidationError, Error);

Object.defineProperty(ValidationError.prototype, "message", {
  enumerable: true,
  get: function() {
    return "Validation of " + this.param + " failed. Expected " + this.expect + ", but received " + JSON.stringify(this.value);
  }
});

ValidationError.prototype.toString = function() {
  return "[" + this.name + "] " + this.message;
};

Validator.create = function(name, object) {
  if(!isObject(object)) throw ValidationError(name, "an object", object);
  object.__proto__ = Validator.prototype;

  return object;
};

/**
 * Express Middleware
 */
Validator.body = function() {
  return function(req, res, next) {
    if (req.body instanceof Object) {
      console.log("Creating validator on body");
      Validator.create("request body", req.body);
    }
    next();
  };
};

Validator.query = function() {
  return function(req, res, next) {
    if (req.query instanceof Object) Validator.create("request body", req.query);
    next();
  };
};

Validator.params = function() {
  return function(req, res, next) {
    if (req.params instanceof Object) Validator.create("request parameters", req.params);
    next();
  };
};
