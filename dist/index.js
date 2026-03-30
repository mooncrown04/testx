"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));
var _stremioAddons = _interopRequireDefault(require("stremio-addons"));
var _serveStatic = _interopRequireDefault(require("serve-static"));
var _package = _interopRequireDefault(require("../package.json"));
var _PornClient = _interopRequireDefault(require("./PornClient"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

const ID = process.env.STREMIO_PORN_ID || 'stremio_porn';
const ENDPOINT = process.env.STREMIO_PORN_ENDPOINT || 'https://testx-mysk.onrender.com';
const PORT = process.env.PORT || '80';

// Nuvio'nun sol menüde göstereceği kataloglar
const CATALOGS = _PornClient.default.ADAPTERS.map(adapter => ({
  type: 'movie',
  id: `catalog_${adapter.ID}`,
  name: `${adapter.DISPLAY_NAME}`,
  extra: [{ name: 'search', isRequired: false }, { name: 'skip', isRequired: false }]
}));

const MANIFEST = {
  id: ID,
  name: 'Porn Plus',
  version: _package.default.version,
  description: 'Nuvio & Stremio Compatible Addon',
  types: ['movie'],
  idProperty: _PornClient.default.ID,
  resources: ['catalog', 'meta', 'stream'], // Nuvio için en kritik satır
  catalogs: CATALOGS,
  endpoint: `${ENDPOINT}/stremioget/stremio/v1`
};

function makeCatalogMethod(client) {
  return function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        const adapterId = request.id.replace('catalog_', '');
        const response = yield client.invokeMethod('meta.search', {
          query: {
            type: 'movie',
            [_PornClient.default.ID]: adapterId,
            search: (request.extra && request.extra.search) ? request.extra.search : ''
          },
          skip: (request.extra && request.extra.skip) ? request.extra.skip : 0
        });
        cb(null, response);
      } catch (err) { cb(err); }
    })();
  };
}

function makeMethod(client, methodName) {
  return function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        const response = yield client.invokeMethod(methodName, request);
        cb(null, response);
      } catch (err) { cb(err); }
    })();
  };
}

let client = new _PornClient.default({ 
  proxy: process.env.STREMIO_PORN_PROXY, 
  cache: process.env.STREMIO_PORN_CACHE || '1' 
});

const methods = {
  'catalog.find': makeCatalogMethod(client),
  'meta.search': makeMethod(client, 'meta.search'),
  'meta.find': makeMethod(client, 'meta.find'),
  'meta.get': makeMethod(client, 'meta.get'),
  'stream.find': makeMethod(client, 'stream.find')
};

let addon = new _stremioAddons.default.Server(methods, MANIFEST);

let server = _http.default.createServer((req, res) => {
  // CORS Ayarları (Nuvio'nun erişebilmesi için şart)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  (0, _serveStatic.default)('static')(req, res, () => {
    addon.middleware(req, res, () => res.end());
  });
});

server.listen(PORT, () => console.log(`Addon listening on ${PORT}`));
