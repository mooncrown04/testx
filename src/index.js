"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));
var _stremioAddons = _interopRequireDefault(require("stremio-addons"));
var _serveStatic = _interopRequireDefault(require("serve-static"));
var _chalk = _interopRequireDefault(require("chalk"));
var _package = _interopRequireDefault(require("../package.json"));
var _PornClient = _interopRequireDefault(require("./PornClient"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

// Desteklenen metodlara catalog.find eklendi
const SUPPORTED_METHODS = ['stream.find', 'meta.find', 'meta.search', 'meta.get', 'catalog.find'];
const STATIC_DIR = 'static';
const DEFAULT_ID = 'stremio_porn';
const ID = process.env.STREMIO_PORN_ID || DEFAULT_ID;
const ENDPOINT = process.env.STREMIO_PORN_ENDPOINT || 'http://localhost';
const PORT = process.env.STREMIO_PORN_PORT || process.env.PORT || '80';
const PROXY = process.env.STREMIO_PORN_PROXY || process.env.HTTPS_PROXY;
const CACHE = process.env.STREMIO_PORN_CACHE || process.env.REDIS_URL || '1';
const EMAIL = process.env.STREMIO_PORN_EMAIL || process.env.EMAIL;
const IS_PROD = process.env.NODE_ENV === 'production';

// Katalogları otomatik oluştur (Her adaptör için bir menü başlığı)
const CATALOGS = _PornClient.default.ADAPTERS.map(adapter => ({
  type: 'movie',
  id: `catalog_${adapter.ID}`,
  name: adapter.DISPLAY_NAME,
  extra: [{ name: 'search' }, { name: 'skip' }]
}));

const MANIFEST = {
  name: 'Porn+',
  id: ID,
  version: _package.default.version,
  description: `Discover movies and streams from ${_PornClient.default.ADAPTERS.map(a => a.DISPLAY_NAME).join(', ')}`,
  types: ['movie', 'tv'],
  idProperty: _PornClient.default.ID,
  dontAnnounce: !IS_PROD,
  sorts: _PornClient.default.SORTS,
  email: EMAIL,
  contactEmail: EMAIL,
  endpoint: `${ENDPOINT}/stremioget/stremio/v1`,
  logo: `${ENDPOINT}/logo.png`,
  icon: `${ENDPOINT}/logo.png`,
  background: `${ENDPOINT}/bg.jpg`,
  catalogs: CATALOGS, // Sinewix gibi sol menüde çıkmasını sağlayan kısım
  resources: ['catalog', 'meta', 'stream'],
  filter: {
    [`query.${_PornClient.default.ID}`]: { $exists: true },
    'query.type': { $in: ['movie', 'tv'] }
  }
};

function makeMethod(client, methodName) {
  return function () {
    var _ref = _asyncToGenerator(function* (request, cb) {
      let response;
      let error;
      try {
        response = yield client.invokeMethod(methodName, request);
      } catch (err) {
        error = err;
        console.error(_chalk.default.gray(new Date().toLocaleString()) + ` Error in ${methodName}:`, err);
      }
      cb(error, response);
    });
    return function (_x, _x2) { return _ref.apply(this, arguments); };
  }();
}

// Katalog isteği geldiğinde (Sol menüden birine tıklandığında) çalışacak motor
function makeCatalogMethod(client) {
  return function () {
    var _refCatalog = _asyncToGenerator(function* (request, cb) {
      try {
        const adapterId = request.id.replace('catalog_', '');
        const response = yield client.invokeMethod('meta.search', {
          query: {
            type: request.type,
            [_PornClient.default.ID]: adapterId,
            search: (request.extra && request.extra.search) ? request.extra.search : ''
          },
          skip: (request.extra && request.extra.skip) ? request.extra.skip : 0
        });
        cb(null, response);
      } catch (err) {
        cb(err);
      }
    });
    return function (req, callback) { return _refCatalog.apply(this, arguments); };
  }();
}

function makeMethods(client, methodNames) {
  const baseMethods = methodNames.reduce((methods, methodName) => {
    if (methodName !== 'catalog.find') {
      methods[methodName] = makeMethod(client, methodName);
    }
    return methods;
  }, {});
  baseMethods['catalog.find'] = makeCatalogMethod(client);
  return baseMethods;
}

let client = new _PornClient.default({ proxy: PROXY, cache: CACHE });
let methods = makeMethods(client, SUPPORTED_METHODS);
let addon = new _stremioAddons.default.Server(methods, MANIFEST);

let server = _http.default.createServer((req, res) => {
  (0, _serveStatic.default)(STATIC_DIR)(req, res, () => {
    addon.middleware(req, res, () => res.end());
  });
});

server.on('listening', () => {
  console.log(_chalk.default.green(`\n ✅ Addon Ready! \n Endpoint: ${MANIFEST.endpoint}`));
}).listen(PORT);

var _default = server;
exports.default = _default;
