"use strict";

const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 10000;
const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const MANIFEST = {
    "id": "org.nuvio.porn.chaturbate",
    "version": "1.0.0",
    "name": "Chaturbate Live",
    "description": "Sinewix Style Scraper",
    "types": ["tv"],
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
    "behaviorHints": { "adult": true }
};

const scraper = {
    async getCatalog(search = "") {
        try {
            const url = search ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}` : BASE_URL;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
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
                        description: $(el).find('.subject').text().trim() || "Live"
                    });
                }
            });
            return metas;
        } catch (e) { 
            console.error("Scraper Hatası:", e.message);
            return []; 
        }
    },
    async getStream(id) {
        try {
            const realId = id.replace('cb_', '');
            const { data } = await axios.post(GET_STREAM_URL, `room_slug=${realId}&bandwidth=high`, {
                headers: { 
                    'X-Requested-With': 'XMLHttpRequest', 
                    'Content-Type': 'application/x-www-form-urlencoded', 
                    'Referer': `${BASE_URL}/${realId}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return data.success ? [{ title: 'HD Live', url: data.url, live: true }] : [];
        } catch (e) { return []; }
    }
};

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // URL'yi parçala ve .json uzantısını temizle
    const cleanUrl = req.url.split('?')[0].replace('.json', '');
    const parts = cleanUrl.split('/').filter(Boolean);

    try {
        // Manifest
        if (cleanUrl === '/' || cleanUrl === '/manifest') {
            return res.end(JSON.stringify(MANIFEST));
        }

        // Katalog (/catalog/tv/cb_popular)
        if (parts[0] === 'catalog') {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const search = urlObj.searchParams.get('search') || "";
            const results = await scraper.getCatalog(search);
            return res.end(JSON.stringify({ metas: results }));
        }

        // Meta (/meta/tv/cb_id)
        if (parts[0] === 'meta') {
            const id = parts[2].replace('cb_', '');
            return res.end(JSON.stringify({ meta: { id: `cb_${id}`, name: id, type: 'tv', posterShape: 'landscape' } }));
        }

        // Stream (/stream/tv/cb_id)
        if (parts[0] === 'stream') {
            const id = parts[2];
            const streams = await scraper.getStream(id);
            return res.end(JSON.stringify({ streams }));
        }

        res.writeHead(404); res.end();
    } catch (e) { 
        console.error("İstek Hatası:", e.message);
        res.end(JSON.stringify({ metas: [] })); 
    }
}).listen(PORT, () => console.log(`Sinewix Mode Active on ${PORT}`));
