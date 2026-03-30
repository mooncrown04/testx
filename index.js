import stremio from 'stremio-addon-sdk';
const { addonBuilder, serveHTTP } = stremio;
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

// 1. SINEWIX FORMATINA TAM UYUMLU MANIFEST
const manifest = {
    id: "org.sinewix.chaturbate",
    version: "1.1.0",
    name: "Sinewix Chaturbate",
    description: "Sinewix Turkce Canli Yayin Eklentisi",
    // Sinewix'teki gibi kaynakları (resources) detaylı tanımlıyoruz
    resources: [
        {
            name: "catalog",
            types: ["tv"],
            idPrefixes: ["cb_"]
        },
        {
            name: "meta",
            types: ["tv"],
            idPrefixes: ["cb_"]
        },
        {
            name: "stream",
            types: ["tv"],
            idPrefixes: ["cb_"]
        }
    ],
    types: ["tv"],
    idPrefixes: ["cb_"],
    catalogs: [
        {
            id: "cb_popular",
            type: "tv",
            name: "Chaturbate Canli",
            extra: [
                {
                    name: "search",
                    isRequired: false
                },
                {
                    name: "skip" // Sinewix'in sayfalama (pagination) için kullandığı yapı
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

// 2. KATALOG YÖNETİCİSİ (Sinewix Mantığı)
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log('[Catalog Request]', { type, id, extra });
    
    if (id !== 'cb_popular' || type !== 'tv') {
        return { metas: [] };
    }

    try {
        const search = extra?.search || '';
        const skip = extra?.skip || 0;
        
        // Arama varsa arama sayfasına, yoksa ana sayfaya git
        let url = search 
            ? `${BASE_URL}/?keywords=${encodeURIComponent(search)}` 
            : BASE_URL;
        
        // Eğer skip varsa (sayfalama), Chaturbate'in sayfa yapısına uyarla
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
                    id: `cb_${username}`, // Prefix: cb_
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
        console.error('[Catalog Error]', err);
        return { metas: [] };
    }
});

// 3. META YÖNETİCİSİ (Detay Sayfası)
builder.defineMetaHandler(async ({ type, id }) => {
    console.log('[Meta Request]', { type, id });
    const username = id.replace('cb_', '');
    
    return {
        meta: {
            id: id,
            type: 'tv',
            name: username,
            description: "Canli Yayin - Chaturbate",
            posterShape: 'landscape',
            background: `https://room-images.chaturbate.com/room-image/${username}.jpg`
        }
    };
});

// 4. STREAM YÖNETİCİSİ (Oynatıcı Linki)
builder.defineStreamHandler(async ({ type, id }) => {
    console.log('[Stream Request]', { type, id });
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
                    name: 'Sinewix HD',
                    title: `${username} - Canli`,
                    url: data.url,
                    live: true
                }]
            };
        }
        return { streams: [] };
    } catch (err) {
        console.error('[Stream Error]', err);
        return { streams: [] };
    }
});

// 5. SUNUCUYU BAŞLAT (Render & Sinewix Uyumlu)
const addonInterface = builder.getInterface();
const PORT = process.env.PORT || 10000;

serveHTTP(addonInterface, { port: PORT }).then(() => {
    console.log(`✅ Sinewix Chaturbate eklentisi hazir: http://localhost:${PORT}/manifest.json`);
});

export default addonInterface;
