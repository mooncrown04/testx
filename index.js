const stremio = require('stremio-addon-sdk');
const { addonBuilder, serveHTTP } = stremio;
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// SİNEWİX İLE AYNI MANİFEST YAPISI
const manifest = {
    id: 'org.sinewix.chaturbate',
    version: '1.1.0',
    name: 'Sinewix Chaturbate',
    description: 'Sinewix Canli Yayin Eklentisi',
    // Sinewix'in kullandığı tüm kaynak tanımları
    catalogs: [
        {
            id: 'sinewix-cb-live',
            type: 'movie',
            name: 'Sinewix Chaturbate Canli',
            extra: [{ name: 'skip' }, { name: 'search', isRequired: false }]
        }
    ],
    resources: [
        { name: 'catalog', types: ['movie'], idPrefixes: ['cb_'] },
        { name: 'meta', types: ['movie'], idPrefixes: ['cb_'] },
        { name: 'stream', types: ['movie'], idPrefixes: ['cb_'] }
    ],
    types: ['movie'],
    idPrefixes: ['cb_']
};

const builder = new addonBuilder(manifest);

// CATALOG HANDLER - Sinewix'in apiGet mantığıyla çalışır
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (id !== 'sinewix-cb-live') return { metas: [] };

    try {
        const search = extra?.search || '';
        const skip = Number(extra?.skip) || 0;
        const page = Math.floor(skip / 12) + 1;

        let url = search 
            ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}&page=${page}` 
            : `${BASE_URL}/?page=${page}`;

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const $ = cheerio.load(data);
        const metas = [];

        $('.list > li').each((i, el) => {
            const user = $(el).find('.title > a').text().trim();
            const img = $(el).find('img').attr('src');
            
            if (user && img) {
                metas.push({
                    id: `cb_${user}`,
                    name: user,
                    type: 'movie',
                    poster: img,
                    posterShape: 'landscape',
                    background: img,
                    description: "Canli Yayin"
                });
            }
        });

        return { metas };
    } catch (err) {
        console.error('Katalog Hatasi:', err.message);
        return { metas: [] };
    }
});

// META HANDLER
builder.defineMetaHandler(async ({ type, id }) => {
    const user = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: 'movie',
            name: user,
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${user}.jpg`
        }
    };
});

// STREAM HANDLER
builder.defineStreamHandler(async ({ type, id }) => {
    const user = id.replace('cb_', '');
    try {
        const response = await axios.post(GET_STREAM_URL, `room_slug=${user}&bandwidth=high`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${BASE_URL}/${user}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (response.data && response.data.success) {
            return {
                streams: [{
                    name: 'Sinewix HD',
                    title: 'Canli Yayini Baslat',
                    url: response.data.url,
                    live: true
                }]
            };
        }
    } catch (e) {
        console.error('Stream Hatasi');
    }
    return { streams: [] };
});

// SUNUCU AYARI - Sinewix'in kullandığı port ve başlatma şekli
const PORT = process.env.PORT || 10000;
serveHTTP(builder.getInterface(), { port: PORT }).then(() => {
    console.log(`✅ Sinewix Mimarisi Hazir: ${PORT}`);
});
