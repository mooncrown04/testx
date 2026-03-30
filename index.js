const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Sinewix Canli Yayin Portali",
    // Nuvio'nun kataloğu görmesi için bu format zorunludur
    resources: [
        { name: "catalog", types: ["movie"], idPrefixes: ["cb_"] },
        { name: "meta", types: ["movie"], idPrefixes: ["cb_"] },
        { name: "stream", types: ["movie"], idPrefixes: ["cb_"] }
    ],
    types: ["movie"],
    idPrefixes: ["cb_"],
    catalogs: [
        {
            type: "movie",
            id: "cb_catalog",
            name: "Sinewix Chaturbate Canli",
            extra: [
                { name: "skip" },
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: ["Female", "Male", "Couples", "Trans", "Teen", "Milf", "Anal"] }
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
    if (id !== 'cb_catalog') return { metas: [] };

    try {
        const { search, genre, skip } = extra || {};
        const page = Math.floor((skip || 0) / 12) + 1;

        let url = BASE_URL;
        if (search) {
            url = `${BASE_URL}/?keywords=${encodeURIComponent(search)}&page=${page}`;
        } else if (genre) {
            url = `${BASE_URL}/tag/${genre.toLowerCase()}/?page=${page}`;
        } else {
            url = `${BASE_URL}/?page=${page}`;
        }

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
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
                    type: "movie",
                    poster: img,
                    posterShape: 'landscape',
                    background: img,
                    description: "Canli Yayinda"
                });
            }
        });
        return { metas };
    } catch (err) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ id }) => {
    const user = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: "movie",
            name: user,
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${user}.jpg`,
            description: "Yayini baslatmak için tiklayin."
        }
    };
});

builder.defineStreamHandler(async ({ id }) => {
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
                streams: [{ name: 'Sinewix HD', title: 'Izle', url: response.data.url, live: true }]
            };
        }
    } catch (e) {}
    return { streams: [] };
});

const PORT = process.env.PORT || 10000;
serveHTTP(builder.getInterface(), { port: PORT });
