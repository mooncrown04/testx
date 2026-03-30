const stremio = require('stremio-addon-sdk');
const { addonBuilder, serveHTTP } = stremio;
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// Nuvio'nun kataloğu görmesi için manifest ayarları
const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Profesyonel Canlı Yayın Eklentisi",
    resources: ["catalog", "meta", "stream"],
    types: ["movie"], // Nuvio kataloğu için movie daha stabil çalışır
    idPrefixes: ["cb_"],
    catalogs: [
        {
            type: "movie",
            id: "cb_catalog",
            name: "Chaturbate Canlı",
            extra: [
                { name: "skip" },
                { name: "search", isRequired: false },
                { 
                    name: "genre", 
                    isRequired: false, 
                    // Gönderdiğin koddaki kategori desteği
                    options: ["Female", "Male", "Couples", "Trans", "Teen", "Milf", "Anal", "Asian", "Latina", "Ebony"] 
                }
            ]
        }
    ],
    behaviorHints: { adult: true, configurable: false }
};

const builder = new addonBuilder(manifest);

// Gönderdiğin koddaki _parseListPage mantığı
async function parseListPage(body) {
    const $ = cheerio.load(body);
    const tagRegexp = /#\S+/g;
    const metas = [];

    $('.list > li').each((i, item) => {
        const $item = $(item);
        const $link = $item.find('.title > a');
        const id = $link.text().trim();
        const subject = $item.find('.subject').text().trim();
        const poster = $item.find('img').attr('src');
        const tags = (subject.match(tagRegexp) || []).map(tag => tag.slice(1));
        
        // İzleyici sayısını çekme mantığı
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
                description: `${viewers} İzleyici - ${tags.join(', ')}`,
                genre: tags
            });
        }
    });
    return metas;
}

// KATALOG HANDLER (Gönderdiğin koddaki _findByPage mantığı)
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (id !== 'cb_catalog') return { metas: [] };

    try {
        const search = extra?.search || '';
        const genre = extra?.genre || '';
        const skip = Number(extra?.skip) || 0;
        const page = Math.floor(skip / 12) + 1;

        let url = BASE_URL;
        if (search) {
            url = `${BASE_URL}/?keywords=${encodeURIComponent(search)}&page=${page}`;
        } else if (genre) {
            url = `${BASE_URL}/tag/${genre.toLowerCase()}/?page=${page}`;
        } else {
            url = `${BASE_URL}/?page=${page}`;
        }

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const metas = await parseListPage(data);
        return { metas };
    } catch (err) {
        return { metas: [] };
    }
});

// META HANDLER (Gönderdiğin koddaki _parseItemPage mantığı)
builder.defineMetaHandler(async ({ id }) => {
    const user = id.replace('cb_', '');
    return {
        meta: {
            id: id,
            type: 'movie',
            name: user,
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${user}.jpg`,
            description: "Canlı Yayın - Chaturbate"
        }
    };
});

// STREAM HANDLER (Gönderdiğin koddaki _getStreams mantığı)
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
                    title: 'Yayını Başlat',
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
    console.log(`✅ Profesyonel Katalog Hazır: ${PORT}`);
});
