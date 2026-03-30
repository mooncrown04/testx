"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));
var _stremioAddons = _interopRequireDefault(require("stremio-addons"));
var _serveStatic = _interopRequireDefault(require("serve-static"));
var _PornClient = _interopRequireDefault(require("./PornClient"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

const PORT = process.env.PORT || '80';

// Paylaştığın Nuvio uyumlu manifest yapısı
const MANIFEST = {
  "id": "org.nuvio.stremioporn",
  "version": "0.0.5",
  "name": "Stremio Porn",
  "description": "Adult content addon for Nuvio",
  "types": ["movie"],
  "catalogs": [
    {
      "type": "movie",
      "id": "stremioporn",
      "name": "Adult Videos",
      "extra": [
        {"name": "search", "isRequired": false},
        {"name": "skip", "isRequired": false}
      ]
    }
  ],
  "resources": ["catalog", "stream", "meta"],
  "idPrefixes": ["porn_id"], // PornClient.js içindeki ID değeri
  "logo": "https://raw.githubusercontent.com/mooncrown04/testx/master/static/logo.png",
  "behaviorHints": {
    "adult": true
  }
};

let client = new _PornClient.default({ 
  proxy: process.env.STREMIO_PORN_PROXY, 
  cache: '1' 
});

const methods = {
  // Nuvio katalogdan bir şeyler istediğinde
  'catalog.find': function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        // PornClient'a "PornHub" üzerinden popülerleri getir diyoruz (Varsayılan olarak ilk adaptör)
        const response = yield client.invokeMethod('meta.search', {
          query: { type: 'movie', search: (request.extra && request.extra.search) ? request.extra.search : '' },
          sort: { 'popularities.porn.PornHub': -1 }, 
          skip: (request.extra && request.extra.skip) ? parseInt(request.extra.skip) : 0
        });
        cb(null, response);
      } catch (err) { cb(null, { metas: [] }); }
    })();
  },
  'meta.get': function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        const response = yield client.invokeMethod('meta.get', request);
        cb(null, { meta: response });
      } catch (err) { cb(err); }
    })();
  },
  'stream.find': function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        const response = yield client.invokeMethod('stream.find', request);
        cb(null, { streams: response });
      } catch (err) { cb(err); }
    })();
  }
};

let addon = new _stremioAddons.default.Server(methods, MANIFEST);

let server = _http.default.createServer((req, res) => {
  // CORS ayarları (Nuvio için hayati)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Nuvio bazen /manifest.json ister, bazen v1 üzerinden ister. 
  // v1/manifest.json isteğini yakalayalım:
  if (req.url.endsWith('manifest.json')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MANIFEST));
    return;
  }

  (0, _serveStatic.default)('static')(req, res, () => {
    addon.middleware(req, res, () => res.end());
  });
});

server.listen(PORT, () => console.log(`Nuvio Addon Ready on ${PORT}`));
