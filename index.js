import stremio from 'stremio-addon-sdk';
const { addonBuilder, serveHTTP } = stremio;
import axios from 'axios'; // httpClient yerine axios kullanıyoruz
import * as cheerio from 'cheerio';

const { addonBuilder: Builder, serveHTTP: Serve } = stremio;

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Profesyonel Chaturbate Adaptörü",
    // Nuvio'nun kataloğu görmesi için bu yapı şart:
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
            name: "Chaturbate Canli",
            extra: [
                { name: "skip" },
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: ["Female", "Male", "Couples", "Trans"] }
            ]
        }
    ],
    behaviorHints: { adult: true, configurable: false }
};

const builder = new addonBuilder(manifest);

// Paylaştığın koddaki _parseListPage mantığı
async function parseListPage(body) {
    const $ = cheerio.load(body);
    const tagRegexp = /#\S+/g;
    const metas = [];

    $('.list > li').each((i, el) => {
        const $item = $(el);
        const $link = $item.find('.title > a');
        const id = $link.text().trim();
        const subject = $item.find('.subject').text().trim();
        const poster = $item.find('img').attr('src');
        const tags = (subject.match(tagRegexp) || []).map(tag => tag.slice(1));
        
        let viewers = $item.find('.cams').text().match(/(\d+) viewers/i);
        viewers = viewers ? viewers[1] : "0";

        if (id && poster) {
            metas.push({
                id: `cb_${id}`,
                name: id,
                type: 'movie',
                poster: poster,
                posterShape: 'landscape',
                background: poster,
                description: `${viewers} İzleyici | ${subject}`
            });
        }
    });
    return metas;
}

// KATALOG HANDLER (_findByPage mantığı)
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (id !== 'cb_catalog') return { metas: [] };

    try {
        const { search, genre, skip } = extra || {};
        const page = Math.floor((skip || 0) / 12) + 1; // Items per page yaklaşık 12-20 arası

        let url = BASE_URL;
        if (search) {
            url = `${BASE_URL}/?keywords=${encodeURIComponent(search)}&page=${page}`;
        } else if (genre) {
            // Chaturbate tag URL yapısı: /tag/genre/
            url = `${BASE_URL}/tag/${genre.toLowerCase()}/?page=${page}`;
        } else {
            url = `${BASE_URL}/?page=${page}`;
        }

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const metas = await parseListPage(data);
        return { metas };
    } catch (err) {
        return { metas: [] };
    }
});

// META HANDLER (_getItem mantığı)
builder.defineMetaHandler(async ({ id }) => {
    const user = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: 'movie',
            name: user,
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${user}.jpg`,
            description: "Canli Yayini Baslatmak için Tıklayın"
        }
    };
});

// STREAM HANDLER (_getStreams mantığı)
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
                streams: [{
                    name: 'Sinewix HD',
                    title: 'Canli İzle',
                    url: response.data.url,
                    live: true
                }]
            };
        }
    } catch (e) {}
    return { streams: [] };
});

const PORT = process.env.PORT || 10000;
serveHTTP(builder.getInterface(), { port: PORT });
