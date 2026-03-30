const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Chaturbate Canli Yayin Eklentisi",
    // Nuvio'nun kataloğu tanıması için resources bu formatta olmalı
    resources: [
        { name: "catalog", types: ["movie", "series"], idPrefixes: ["cb_"] },
        { name: "meta", types: ["movie", "series"], idPrefixes: ["cb_"] },
        { name: "stream", types: ["movie", "series"], idPrefixes: ["cb_"] }
    ],
    types: ["movie", "series"],
    idPrefixes: ["cb_"],
    catalogs: [
        {
            type: "movie", // Nuvio ana sayfa için movie şart
            id: "cb_catalog",
            name: "Sinewix: Chaturbate Canli",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false }
            ]
        }
    ],
    behaviorHints: {
        adult: true,
        configurable: false
    }
};

const builder = new addonBuilder(manifest);

// KATALOG ÇEKME MANTIĞI
builder.defineCatalogHandler(async (args) => {
    if (args.id !== 'cb_catalog') return { metas: [] };

    try {
        const skip = args.extra && args.extra.skip ? args.extra.skip : 0;
        const page = Math.floor(skip / 12) + 1;
        
        let url = args.extra && args.extra.search 
            ? `${BASE_URL}/?keywords=${encodeURIComponent(args.extra.search)}&page=${page}`
            : `${BASE_URL}/?page=${page}`;

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const metas = [];

        $('.list > li').each((i, el) => {
            const user = $(el).find('.title > a').text().trim();
            const img = $(el).find('img').attr('src');
            const viewers = $(el).find('.cams').text().trim();

            if (user && img) {
                metas.push({
                    id: `cb_${user}`,
                    name: user,
                    type: "movie",
                    poster: img,
                    posterShape: 'landscape',
                    background: img,
                    description: `${viewers} izleyici şu an canlı yayında.`
                });
            }
        });

        return { metas: metas };
    } catch (err) {
        console.error("Katalog Hatası:", err.message);
        return { metas: [] };
    }
});

// META BİLGİSİ
builder.defineMetaHandler(async (args) => {
    const user = args.id.replace('cb_', '');
    return {
        meta: {
            id: args.id,
            type: "movie",
            name: user,
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${user}.jpg`,
            description: "Canlı yayını izlemek için oynat tuşuna basın."
        }
    };
});

// YAYIN LİNKİ (STREAM)
builder.defineStreamHandler(async (args) => {
    const user = args.id.replace('cb_', '');
    try {
        const res = await axios.post(GET_STREAM_URL, `room_slug=${user}&bandwidth=high`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${BASE_URL}/${user}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (res.data && res.data.success) {
            return {
                streams: [
                    {
                        name: 'Sinewix HD',
                        title: 'Canli Yayini Baslat',
                        url: res.data.url,
                        live: true
                    }
                ]
            };
        }
    } catch (e) {
        console.error("Yayın çekilemedi.");
    }
    return { streams: [] };
});

const PORT = process.env.PORT || 10000;
serveHTTP(builder.getInterface(), { port: PORT });
