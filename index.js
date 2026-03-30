"use strict";

const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 10000;
const BASE_URL = 'https://www.pornhub.com';

const MANIFEST = {
    "id": "org.nuvio.pornhub.v4",
    "version": "1.0.0",
    "name": "Pornhub Sinewix",
    "description": "Sinewix Style Pornhub Addon",
    "types": ["movie"],
    "resources": ["catalog", "meta", "stream"],
    "catalogs": [
        {
            "type": "movie",
            "id": "ph_trending",
            "name": "Pornhub Trendler",
            "extra": [{ "name": "search", "isRequired": false }]
        }
    ],
    "idPrefixes": ["ph_"],
    "behaviorHints": { "adult": true }
};

const scraper = {
    async getCatalog(search = "") {
        try {
            const url = search 
                ? `${BASE_URL}/video/search?search=${encodeURIComponent(search)}` 
                : `${BASE_URL}/video?o=tr`; // Trending (Trendler)
            
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 8000
            });
            
            const $ = cheerio.load(data);
            const metas = [];

            // Pornhub'daki video listeleme seçicileri
            $('.videoJsRelated, .pcVideoListItem').each((i, el) => {
                const $el = $(el);
                const title = $el.find('.title a').text().trim();
                const link = $el.find('.title a').attr('href');
                const thumb = $el.find('img').attr('data-mediumthumb') || $el.find('img').attr('src');
                
                if (title && link) {
                    const id = link.match(/view_key=([^&]+)/);
                    if (id) {
                        metas.push({
                            id: `ph_${id[1]}`,
                            name: title,
                            type: 'movie',
                            poster: thumb,
                            posterShape: 'landscape',
                            background: thumb
                        });
                    }
                }
            });
            return metas;
        } catch (e) {
            console.error("Scraper Hatası:", e.message);
            return [];
        }
    },

    async getStream(id) {
        const videoId = id.replace('ph_', '');
        // Pornhub direkt video linki vermek yerine sayfada oynatır. 
        // Nuvio'nun webview üzerinden açması için sayfa linkini gönderiyoruz.
        return [{
            title: 'Hemen İzle',
            url: `${BASE_URL}/view_video.php?viewkey=${videoId}`,
            externalUrl: `${BASE_URL}/view_video.php?viewkey=${videoId}`
        }];
    }
};

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // URL'yi temizle (Sondaki .json'u ve parametreleri ayıkla)
    const urlPath = req.url.split('?')[0].replace('.json', '');
    const parts = urlPath.split('/').filter(Boolean);

    try {
        // 1. Manifest
        if (urlPath === '/' || urlPath === '/manifest') {
            return res.end(JSON.stringify(MANIFEST));
        }

        // 2. Katalog
        if (parts[0] === 'catalog') {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const search = urlObj.searchParams.get('search') || "";
            const results = await scraper.getCatalog(search);
            return res.end(JSON.stringify({ metas: results }));
        }

        // 3. Meta (Gerekli ama basit tutuyoruz)
        if (parts[0] === 'meta') {
            const id = parts[2];
            return res.end(JSON.stringify({ meta: { id, type: 'movie', name: "Pornhub Video" } }));
        }

        // 4. Stream
        if (parts[0] === 'stream') {
            const id = parts[2];
            const streams = await scraper.getStream(id);
            return res.end(JSON.stringify({ streams }));
        }

        res.writeHead(404); res.end();
    } catch (e) {
        res.end(JSON.stringify({ metas: [] }));
    }
}).listen(PORT, () => console.log(`Sinewix Aktif: ${PORT}`));
