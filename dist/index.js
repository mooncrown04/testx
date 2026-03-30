"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

var _http = _interopRequireDefault(require("http"));
var _serveStatic = _interopRequireDefault(require("serve-static"));
var _PornClient = _interopRequireDefault(require("./PornClient"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

const PORT = process.env.PORT || '80';

// Nuvio'nun kabul ettiği v4 Manifestosu
const MANIFEST = {
  "id": "org.nuvio.stremioporn",
  "version": "0.0.6",
  "name": "Stremio Porn",
  "description": "Adult content for Nuvio",
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
  "idPrefixes": ["porn_id"],
  "behaviorHints": { "adult": true }
};

let client = new _PornClient.default({ cache: '1' });

const server = _http.default.createServer((req, res) => {
  // CORS & JSON Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url;

  // 1. MANIFEST İSTEĞİ
  if (url.endsWith('manifest.json')) {
    res.end(JSON.stringify(MANIFEST));
    return;
  }

  // 2. KATALOG İSTEĞİ (Nuvio buradan videoları çeker)
  if (url.includes('/catalog/movie/stremioporn')) {
    _asyncToGenerator(function* () {
      try {
        // Nuvio'dan gelen search veya skip parametrelerini ayıkla
        const searchMatch = url.match(/search=([^&]+)/);
        const skipMatch = url.match(/skip=(\d+)/);
        
        const query = {
          type: 'movie',
          search: searchMatch ? decodeURIComponent(searchMatch[1]) : ''
        };

        // PornClient'a "PornHub" popülerleri getir diyoruz
        const results = yield client.invokeMethod('meta.search', {
          query: query,
          sort: { 'popularities.porn.PornHub': -1 },
          skip: skipMatch ? parseInt(skipMatch[1]) : 0
        });

        // Nuvio'nun beklediği v4 formatı: { metas: [...] }
        res.end(JSON.stringify({ metas: results || [] }));
      } catch (err) {
        res.end(JSON.stringify({ metas: [] }));
      }
    })();
    return;
  }

  // 3. META (DETAY) İSTEĞİ
  if (url.includes('/meta/movie/')) {
    _asyncToGenerator(function* () {
      try {
        const id = url.split('/').pop().replace('.json', '');
        const result = yield client.invokeMethod('meta.get', { query: { porn_id: id } });
        res.end(JSON.stringify({ meta: result }));
      } catch (err) { res.end(JSON.stringify({ meta: {} })); }
    })();
    return;
  }

  // 4. STREAM (VİDEO LİNKİ) İSTEĞİ
  if (url.includes('/stream/movie/')) {
    _asyncToGenerator(function* () {
      try {
        const id = url.split('/').pop().replace('.json', '');
        const results = yield client.invokeMethod('stream.find', { query: { porn_id: id } });
        res.end(JSON.stringify({ streams: results || [] }));
      } catch (err) { res.end(JSON.stringify({ streams: [] })); }
    })();
    return;
  }

  // Statik dosyalar için (logo vb.)
  (0, _serveStatic.default)('static')(req, res, () => {
    res.writeHead(404);
    res.end();
  });
});

server.listen(PORT, () => console.log(`Nuvio Bridge Active on ${PORT}`));
