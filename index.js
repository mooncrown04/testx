import stremio from 'stremio-addon-sdk';
const { addonBuilder, serveHTTP } = stremio;
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// Nuvio'nun kataloğu görmesi için türü "movie" (film) olarak değiştirdik
const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Sinewix Turkce Canli Yayin Eklentisi",
    resources: [
        {
            name: "catalog",
            types: ["movie"], // tv -> movie yapıldı
            idPrefixes: ["cb_"]
        },
        {
            name: "meta",
            types: ["movie"], // tv -> movie yapıldı
            idPrefixes: ["cb_"]
        },
        {
            name: "stream",
            types: ["movie"], // tv -> movie yapıldı
            idPrefixes: ["cb_"]
        }
    ],
    types: ["movie"], // tv -> movie yapıldı
    idPrefixes: ["cb_"],
    catalogs: [
        {
            id: "cb_popular",
            type: "movie", // tv -> movie yapıldı
            name: "Chaturbate Canli",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip" }
            ]
        }
    ],
    behaviorHints: {
        adult: true,
        configurable: false
    }
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    // Sadece movie tipindeki isteklere cevap veriyoruz
    if (id !== 'cb_popular' || type !== 'movie') {
        return { metas: [] };
    }

    try {
        const search = extra?.search || '';
        const skip = extra?.skip || 0;
        
        let url = search 
            ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}` 
            : BASE_URL;
        
        if (skip > 0) {
            const page = Math.floor(skip / 12) + 1;
            url = search ? `${url}&page=${page}` : `${url}?page=${page}`;
        }

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
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
                    type: 'movie', // tv -> movie yapıldı
                    poster: poster,
                    posterShape: 'landscape',
                    background: poster,
                    description: $(el).find('.subject').text().trim() || "Live Cam"
                });
            }
        });

        return { metas };
    } catch (err) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ type, id }) => {
    const username = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: 'movie', // tv -> movie yapıldı
            name: username,
            description: "Canli Yayin - Chaturbate",
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${username}.jpg`
        }
    };
});

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
        if (data.success) {
            return {
                streams: [{
                    name: 'Sinewix HD',
                    title: `${username} - Canli`,
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

const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 10000;

serveHTTP(addonInterface, { port: PORT }).then(() => {
    console.log(`✅ Sinewix Chaturbate (Movie Mode) hazir: http://localhost:${PORT}/manifest.json`);
});

export default addonInterface;
