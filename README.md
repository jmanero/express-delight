Express Delight
===============
_Make your [Express](http://expressjs.com/) app
development [Delightful](https://www.youtube.com/watch?v=00rshDuel34)_

## Body
Separates body reader, JSON , and URL-Encoded string parsing into different handlers.

### reader
```
var Body = require("express-delight").Body;
...
app.use(Body.reader({
  limit: 1024000 // Default 100kB payload size limit
}));
```
`reader` aggregates a request body into a buffer at `request.raw`. The handler
will block subsequent handlers until the incoming-request emits its `end` event.
During the request, if the byte-length of received data exceeds `options.limit`,
the handler will respond with `HTTP 413 Request Entity Too Large`. On `end`, the
request payload will be truncated to the byte-length of `Content-Length` if
the header is present.

### json
```
var Body = require("express-delight").Body;
...
app.use(Body.reader({
  limit: 1024000 // Default 100kB payload size limit
}));
app.use(Body.json());
```
`json` checks for JSON-compatable `Content-Type`s using `req.is("json")`.
The request payload is parsed with the native `JSON` codec. Malformed
JSON bodies will result in an error response.

### urlencoded
```
var Body = require("express-delight").Body;
...
app.use(Body.reader({
  limit: 1024000 // Default 100kB payload size limit
}));
// app.use(Body.json()); too, if you're feeling accomodating...
app.use(Body.urlencoded());
```
`urlencoded` checks for URL-Encoded `Content-Type`s using `req.is("urlencoded")`.
The request payload is decoded using `tjholowaychuk`'s [qs](https://www.npmjs.org/package/qs)
implementation. Malformed bodies will result in an error response.

### Helper
`reader`, `json`, and `urlencoded` can be added to the app with the
`Delight.body` helper:
```
app.use(require("express-delight").body());
```

## Errors
Provides an error handler with response formatting based upon the `Accept`
header. Controllers can pass an Error object or a Number to `next`. Response
codes will be read with precedence `error.status || error.statusCode || 500`
for Error objects. Numbers will be used as the response status with a generic
error message.

`Errors` also provides the `HTTPError` class and child classes for common error
codes, allowing for additional data to be included in responses for more
expressive debugging than a status code alone.

### Usage
```
var Errors = require("express-delight").Errors;
...
Delight.util(app); // REQUIRED for Errors
app.use(app.router);

// After the router
app.use(Errors({
  views: false, // Boolean: Use app's views to render HTML. Default `false`
  template: "error.ejs" // Template to render for errors. Only for `views: true`
}));
...

app.get("/test", function(req, res, next) {
  next(404);
});

app.get("/widget/:id", function(req, res, next) {
  next(new Errors.DoesNotExist("widget", req.params.id));
});
```

## Session
```
var Session = require("express-delight").Session;
...

Session.set(<option>, <value>); // Global session options

/**
 * Default is an in-memory store, not suitable for your
 * production use-case...
 */
Session.set("store", new CustomStore(...));

// Start the session reaper
Session.startReaper();

app.use(Session.express({
  // App-specific options
}));
// app.use(Delight.session({...}))

// Socket.IO 1.0 Supoprt!
io.use(Session.io({
  // Socket-specific options
}));
```

### Options
* `store` The session storage module
* `cookie_name` The name of the session cookie. Default "Session-ID"
* `maxage` The inactivity timeout of a session, in minutes. Default 60
* `reap_interval` The interval upon which the store should have stale
  sessions purged, in seconds. Default 60, 0 to stop/disable the reaper loop
* `authorize_path` The path to which un-authenticated requests should be redirected.
   E.g. a login dialog or an OAuth handshake redirect. Default "/authorize"
* `allow_paths` Array: Roots that do not require an authenticated session.
  E.g. ["/welcome", "/foo/bar"] white-lists `/welcome`, `/welcome/a/b/c`,
  and `/foo/bar/baz`. Automatically includes `authorize_path`

### TODO
* Document the MemStore (`Session.Store`) interface.
* Provide Store interfaces for a few common backends. (Redis/Memcache?)

## Validate
Attach assertion testing helpers to request entities. Failed assertions will be caught
by error-handler middleware.
```
var Validate = require("express-delight").Validate;
...

app.use(Validate.body());
app.use(Validate.query());
app.use(Validate.params());

// Or, the short-hand
Delight.validate(app);

app.get("/test-2", function(req, res, next) {
  req.body.isNumber("foo");
  req.body.isString("bar");

  ...
});
```

### TODO
* Document all of the methods exposed by validate-able objects. RtFS for now :(
