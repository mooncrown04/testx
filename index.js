"use strict";

const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 80;
const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// 1. MANIFEST (Nuvio eklentiyi buradan tanır)
const MANIFEST = {
    "id": "org.nuvio.porn.chaturbate",
    "version": "1.0.0",
    "name": "Chaturbate Live",
    "description": "Sinewix Style Live Cams",
    "types": ["tv", "movie"],
    "resources": ["catalog", "meta", "stream"],
    "catalogs": [
        {
            "type": "tv",
            "id": "cb_popular",
            "name": "Chaturbate Canlı",
            "extra": [{ "name": "search", "isRequired": false }]
        }
    ],
    "idPrefixes": ["cb_"],
    "behaviorHints": { "adult": true, "configurable": false }
};

// 2. KAZIYICI MANTIĞI (Scraper)
const scraper = {
    // Sayfayı kazıyıp liste oluşturur
    async getCatalog(search = "") {
        try {
            const url = search 
                ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}` 
                : BASE_URL;
            
            const { data } = await axios.get(url, { timeout: 5000 });
            const $ = cheerio.load(data);
            const metas = [];

            $('.list > li').each((i, el) => {
                const id = $(el).find('.title > a').text().trim();
                const poster = $(el).find('img').attr('src');
                
                if (id && poster) {
                    metas.push({
                        id: `cb_${id}`,
                        name: id,
                        type: 'tv',
                        poster: poster,
                        posterShape: 'landscape',
                        background: poster,
                        description: $(el).find('.subject').text().trim() || "Live Cam"
                    });
                }
            });
            return metas;
        } catch (e) {
            console.error("Scraper Hatası:", e.message);
            return [];
        }
    },

    // Canlı yayın linkini (m3u8) çözer
    async getStream(id) {
        try {
            const realId = id.replace('cb_', '');
            const { data } = await axios.post(GET_STREAM_URL, 
                `room_slug=${realId}&bandwidth=high`, 
                {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': `${BASE_URL}/${realId}`
                    }
                }
            );

            if (data.success && data.room_status === 'public') {
                return [{
                    title: 'HD Canlı Yayın',
                    url: data.url, // Doğrudan m3u8 linki
                    live: true
                }];
            }
            return [];
        } catch (e) {
            return [];
        }
    }
};

// 3. HTTP SUNUCU (Nuvio İsteklerini Karşılar)
const server = http.createServer(async (req, res) => {
    // CORS Başlıkları (Nuvio'nun erişimi için ŞART)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url;
    const parts = url.split('/').filter(Boolean);

    try {
        // Manifest: /manifest.json
        if (url === '/' || url === '/manifest.json') {
            return res.end(JSON.stringify(MANIFEST));
        }

        // Katalog: /catalog/tv/cb_popular.json
        if (parts[0] === 'catalog') {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const search = urlObj.searchParams.get('search') || "";
            const results = await scraper.getCatalog(search);
            return res.end(JSON.stringify({ metas: results }));
        }

        // Meta (Detay): /meta/tv/cb_id.json
        if (parts[0] === 'meta') {
            const id = parts[2].replace('.json', '').replace('cb_', '');
            return res.end(JSON.stringify({
                meta: {
                    id: `cb_${id}`,
                    name: id,
                    type: 'tv',
                    description: "Canlı Yayın"
                }
            }));
        }

        // Stream (Oynat): /stream/tv/cb_id.json
        if (parts[0] === 'stream') {
            const id = parts[2].replace('.json', '');
            const streams = await scraper.getStream(id);
            return res.end(JSON.stringify({ streams }));
        }

        res.writeHead(404); res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
        res.end(JSON.stringify({ metas: [], streams: [], error: err.message }));
    }
});

server.listen(PORT, () => {
    console.log(`Eklenti Aktif! Port: ${PORT}`);
    console.log(`Nuvio Linki: /manifest.json`);
});
