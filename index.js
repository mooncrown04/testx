const stremio = require('stremio-addon-sdk');
const { addonBuilder, serveHTTP } = stremio;
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// PAYLAŞTIĞIN ÖRNEĞE TAM UYUMLU MANIFEST
const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Sinewix Canli Yayin ve Kategori Destekli Eklenti",
    resources: ["catalog", "meta", "stream"],
    types: ["movie"],
    idPrefixes: ["cb_"],
    catalogs: [
        {
            type: "movie",
            id: "cb_catalog",
            name: "Chaturbate Canli",
            extra: [
                { name: "skip" },
                { name: "search", isRequired: false },
                { 
                    name: "genre", 
                    isRequired: false, 
                    // Chaturbate üzerindeki popüler etiketler/odalar
                    options: ["Female", "Male", "Couples", "Trans", "Teen", "Milf", "Anal", "Asian", "Latina", "Ebony", "Big Ass", "Webcam"] 
                }
            ]
        }
    ],
    behaviorHints: {
        adult: true,
        configurable: false
    }
};

const builder = new addonBuilder(manifest);

// KATALOG YÖNETİCİSİ
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (id !== 'cb_catalog') return { metas: [] };

    try {
        const search = extra?.search || '';
        const genre = extra?.genre || '';
        const skip = Number(extra?.skip) || 0;
        const page = Math.floor(skip / 12) + 1;

        let url = BASE_URL;

        // 1. Arama varsa arama URL'si
        if (search) {
            url = `${BASE_URL}/?keywords=${encodeURIComponent(search)}&page=${page}`;
        } 
        // 2. Kategori (Genre) seçilmişse kategori URL'si
        else if (genre) {
            // Chaturbate URL yapısı: chaturbate.com/female-cams/
            url = `${BASE_URL}/${genre.toLowerCase()}-cams/?page=${page}`;
        } 
        // 3. Hiçbiri yoksa ana sayfa
        else {
            url = `${BASE_URL}/?page=${page}`;
        }

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
                    description: $(el).find('.subject').text().trim() || "Live"
                });
            }
        });

        return { metas: metas };
    } catch (err) {
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
                    title: 'Canli Yayini Izle',
                    url: response.data.url,
                    live: true
                }]
            };
        }
    } catch (e) {}
    return { streams: [] };
});

const PORT = process.env.PORT || 10000;
serveHTTP(builder.getInterface(), { port: PORT }).then(() => {
    console.log(`✅ Katalog Destekli Sinewix Hazir: ${PORT}`);
});
