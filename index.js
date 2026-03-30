import stremio from 'stremio-addon-sdk';
const { addonBuilder, serveHTTP } = stremio;
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const manifest = {
    id: 'org.sinewix.chaturbate',
    version: '1.1.0',
    name: 'Sinewix Chaturbate',
    description: 'Chaturbate Live Cams (Sinewix Style)',
    resources: ['catalog', 'stream', 'meta'],
    types: ['tv'],
    idPrefixes: ['cb_'],
    catalogs: [
        {
            type: 'tv',
            id: 'cb_popular',
            name: 'Chaturbate Canlı',
            extra: [{ name: 'search', isRequired: false }]
        }
    ],
    behaviorHints: { adult: true }
};

const builder = new addonBuilder(manifest);

// KATALOG YÖNETİCİSİ
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (id !== 'cb_popular') return { metas: [] };

    try {
        const search = extra?.search || '';
        const url = search 
            ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}` 
            : BASE_URL;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const body = await res.text();
        const $ = cheerio.load(body);
        const metas = [];

        $('.list > li').each((i, el) => {
            const username = $(el).find('.title > a').text().trim();
            const poster = $(el).find('img').attr('src');
            
            if (username && poster) {
                metas.push({
                    id: `cb_${username}`,
                    name: username,
                    type: 'tv',
                    poster: poster,
                    posterShape: 'landscape',
                    background: poster,
                    description: $(el).find('.subject').text().trim() || "Live Cam"
                });
            }
        });

        return { metas };
    } catch (err) {
        console.error(err);
        return { metas: [] };
    }
});

// META YÖNETİCİSİ (Tıklayınca detay sayfası)
builder.defineMetaHandler(async ({ type, id }) => {
    const username = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: 'tv',
            name: username,
            description: "Canlı Yayın - Chaturbate",
            posterShape: 'landscape'
        }
    };
});

// STREAM YÖNETİCİSİ (Oynat deyince çalışan kısım)
builder.defineStreamHandler(async ({ type, id }) => {
    const username = id.replace('cb_', '');
    
    try {
        const response = await fetch(GET_STREAM_URL, {
            method: 'POST',
            body: `room_slug=${username}&bandwidth=high`,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${BASE_URL}/${username}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        const data = await response.json();

        if (data.success && data.room_status === 'public') {
            return {
                streams: [{
                    title: 'HD Canlı Yayın',
                    url: data.url,
                    live: true
                }]
            };
        }
        return { streams: [] };
    } catch (err) {
        return { streams: [] };
    }
});

// SUNUCUYU BAŞLAT
const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 10000;

serveHTTP(addonInterface, { port: PORT }).then(() => {
    console.log(`✅ Chaturbate Addon hazır: http://localhost:${PORT}/manifest.json`);
});
