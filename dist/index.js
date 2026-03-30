"use strict";

const http = require('http');
// PornClient'ın default export edildiğinden emin oluyoruz
const PornClient = require('./PornClient').default || require('./PornClient');

const PORT = process.env.PORT || 80;
const client = new PornClient({ cache: '1' });

// Nuvio'nun "Hah, bu doğru eklenti" dediği modern v4 Manifest
const MANIFEST = {
  "id": "org.nuvio.stremioporn",
  "version": "1.0.0",
  "name": "Stremio Porn",
  "description": "Adult videos for Nuvio",
  "types": ["movie"],
  "resources": ["catalog", "stream", "meta"],
  "catalogs": [
    {
      "type": "movie",
      "id": "stremioporn",
      "name": "Adult Videos",
      "extra": [
        { "name": "search", "isRequired": false },
        { "name": "skip", "isRequired": false }
      ]
    }
  ],
  "idPrefixes": ["porn_id"],
  "behaviorHints": { "adult": true }
};

const server = http.createServer(async (req, res) => {
  // CORS ve JSON Başlıkları (Nuvio için hayati)
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
  console.log("Nuvio İsteği:", url);

  try {
    // 1. Manifest Dosyası
    if (url === '/' || url.endsWith('/manifest.json')) {
      return res.end(JSON.stringify(MANIFEST));
    }

    // 2. Katalog (Nuvio videoları listelerken buraya bakar)
    if (url.includes('/catalog/movie/stremioporn')) {
      const searchMatch = url.match(/search=([^&.]+)/);
      const skipMatch = url.match(/skip=(\d+)/);
      
      const results = await client.invokeMethod('meta.search', {
        query: { 
          type: 'movie', 
          search: searchMatch ? decodeURIComponent(searchMatch[1]) : '' 
        },
        // PornClient.js'deki adaptör ismine göre (PornHub varsayılan)
        sort: { 'popularities.porn.PornHub': -1 }, 
        skip: skipMatch ? parseInt(skipMatch[1]) : 0,
        limit: 20
      });

      // ÖNEMLİ: Nuvio v4 formatında { metas: [] } bekler
      return res.end(JSON.stringify({ metas: results || [] }));
    }

    // 3. Meta (Video Detayları)
    if (url.includes('/meta/movie/')) {
      const id = url.split('/').pop().replace('.json', '');
      const result = await client.invokeMethod('meta.get', { 
        query: { porn_id: id } 
      });
      return res.end(JSON.stringify({ meta: result }));
    }

    // 4. Stream (Video Oynatma Linkleri)
    if (url.includes('/stream/movie/')) {
      const id = url.split('/').pop().replace('.json', '');
      const results = await client.invokeMethod('stream.find', { 
        query: { porn_id: id } 
      });
      return res.end(JSON.stringify({ streams: results || [] }));
    }

    // Geçersiz istekler için boş dön
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));

  } catch (err) {
    console.error("Hata:", err.message);
    // Hata durumunda Nuvio'nun kilitlenmemesi için boş liste dön
    res.end(JSON.stringify({ metas: [], streams: [] }));
  }
});

server.listen(PORT, () => {
  console.log(`Sunucu aktif: Port ${PORT}`);
});
