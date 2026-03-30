"use strict";

const http = require('http');
const PornClient = require('./PornClient').default;

const PORT = process.env.PORT || 80;
const client = new PornClient({ cache: '1' });

// Nuvio'nun istediği Modern Manifest
const MANIFEST = {
  id: "org.nuvio.stremioporn",
  version: "1.0.0",
  name: "Stremio Porn",
  description: "Adult content for Nuvio",
  types: ["movie"],
  resources: ["catalog", "stream", "meta"],
  catalogs: [
    {
      type: "movie",
      id: "stremioporn",
      name: "Adult Videos",
      extra: [{ name: "search" }, { name: "skip" }]
    }
  ],
  idPrefixes: ["porn_id"],
  behaviorHints: { adult: true }
};

const server = http.createServer(async (req, res) => {
  // CORS Ayarları (Nuvio için kritik)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url;
  console.log("Gelen İstek:", url);

  try {
    // 1. Manifest
    if (url === '/' || url === '/manifest.json') {
      return res.end(JSON.stringify(MANIFEST));
    }

    // 2. Katalog (Nuvio videoları buradan çeker)
    if (url.includes('/catalog/movie/stremioporn')) {
      const searchMatch = url.match(/search=([^&]+)/);
      const skipMatch = url.match(/skip=(\d+)/);
      
      const results = await client.invokeMethod('meta.search', {
        query: { 
          type: 'movie', 
          search: searchMatch ? decodeURIComponent(searchMatch[1]) : '' 
        },
        sort: { 'popularities.porn.PornHub': -1 }, // PornHub'ı varsayılan yaptık
        skip: skipMatch ? parseInt(skipMatch[1]) : 0
      });

      // Nuvio'nun beklediği v4 formatı
      return res.end(JSON.stringify({ metas: results || [] }));
    }

    // 3. Meta Detay
    if (url.includes('/meta/movie/')) {
      const id = url.split('/').pop().replace('.json', '');
      const result = await client.invokeMethod('meta.get', { 
        query: { porn_id: id } 
      });
      return res.end(JSON.stringify({ meta: result }));
    }

    // 4. Stream (Video Linki)
    if (url.includes('/stream/movie/')) {
      const id = url.split('/').pop().replace('.json', '');
      const results = await client.invokeMethod('stream.find', { 
        query: { porn_id: id } 
      });
      return res.end(JSON.stringify({ streams: results || [] }));
    }

    // Bilinmeyen istek
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));

  } catch (err) {
    console.error("Hata Oluştu:", err.message);
    res.end(JSON.stringify({ metas: [], streams: [], error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Nuvio Standalone Server: http://localhost:${PORT}`);
});
