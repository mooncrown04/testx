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

const PORT = process.env.PORT || '80';
const HOST = "testx-mysk.onrender.com"; // Senin Render adresin

// Nuvio'nun "Kategoriler" kısmında görmek istediği liste
const CATALOGS = _PornClient.default.ADAPTERS.map(adapter => ({
  type: 'movie',
  id: `catalog_${adapter.name}`,
  name: adapter.DISPLAY_NAME,
  extra: [{ name: 'search' }, { name: 'skip' }]
}));

const MANIFEST = {
  id: "org.stremio.pornplus", // Benzersiz bir ID
  name: 'Porn Plus',
  version: "1.0.0",
  description: 'Nuvio & Stremio Adult Content',
  types: ['movie'],
  idProperty: _PornClient.default.ID,
  // Nuvio bu 3 satırı görmezse "Ekle" butonu çıkmaz veya hata verir:
  resources: ['catalog', 'meta', 'stream'],
  catalogs: CATALOGS,
  background: `https://${HOST}/bg.jpg`,
  logo: `https://${HOST}/logo.png`,
  contactEmail: "contact@stremio.com"
};

// Katalog İsteklerini Karşıla
function makeCatalogMethod(client) {
  return function (request, cb) {
    _asyncToGenerator(function* () {
      try {
        const adapterName = request.id.replace('catalog_', '');
        const response = yield client.invokeMethod('meta.search', {
          query: { type: 'movie' },
          sort: { [`popularities.porn.${adapterName}`]: -1 },
          skip: (request.extra && request.extra.skip) ? parseInt(request.extra.skip) : 0
        });
        cb(null, response);
      } catch (err) { cb(null, { metas: [] }); }
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
  cache: '1' 
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
  // CORS ve Header Ayarları (Nuvio için hayati önemde)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  (0, _serveStatic.default)('static')(req, res, () => {
    addon.middleware(req, res, () => {
        if (!res.writableEnded) {
            res.writeHead(404);
            res.end();
        }
    });
  });
});

server.listen(PORT, () => console.log(`Nuvio Mode: Active on ${PORT}`));
