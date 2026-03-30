const cheerio = require('cheerio');
const axios = require('axios'); // HttpClient yerine daha standart axios kullanıyoruz

const BASE_URL = 'https://chaturbate.com';
const GET_STREAM_URL = 'https://chaturbate.com/get_edge_hls_url_ajax/';

const addon = {
    // 1. KATALOG KAZIYICI (Kapakları getiren kısım)
    getCatalog: async (search = '', page = 1) => {
        try {
            const url = search 
                ? `${BASE_URL}/?page=${page}&keywords=${encodeURIComponent(search)}` 
                : `${BASE_URL}/?page=${page}`;
            
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const metas = [];

            $('.list > li').each((i, el) => {
                const $item = $(el);
                const $link = $item.find('.title > a');
                const id = $link.text().trim();
                
                if (id) {
                    metas.push({
                        id: `porn_id:chaturbate-${id}`, // Senin formatın
                        name: id,
                        type: 'tv',
                        poster: $item.find('img').attr('src'),
                        posterShape: 'landscape',
                        background: $item.find('img').attr('src'),
                        description: $item.find('.subject').text().trim()
                    });
                }
            });

            return { metas };
        } catch (e) {
            console.error("Katalog Hatası:", e);
            return { metas: [] };
        }
    },

    // 2. META DETAY (Tıklayınca açılan sayfa)
    getMeta: async (id) => {
        try {
            const realId = id.split('-').pop(); // 'porn_id:chaturbate-username' -> 'username'
            const { data } = await axios.get(`${BASE_URL}/${realId}`);
            const $ = cheerio.load(data);

            return {
                meta: {
                    id: id,
                    type: 'tv',
                    name: realId,
                    background: $('meta[property="og:image"]').attr('content'),
                    poster: $('meta[property="og:image"]').attr('content'),
                    description: $('meta[property="og:description"]').attr('content') || ''
                }
            };
        } catch (e) {
            return { meta: {} };
        }
    },

    // 3. STREAM KAZIYICI (Oynat deyince m3u8 linkini çözen kısım)
    getStreams: async (id) => {
        try {
            const realId = id.split('-').pop();
            
            // Chaturbate'in m3u8 linkini almak için yaptığı AJAX isteği
            const { data } = await axios.post(GET_STREAM_URL, 
                `room_slug=${realId}&bandwidth=high`, 
                {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': `${BASE_URL}/${realId}`
                    }
                }
            );

            if (data.success && data.room_status === 'public') {
                return {
                    streams: [{
                        title: 'Live Stream (Chaturbate)',
                        url: data.url, // Bu doğrudan .m3u8 linkidir
                        live: true
                    }]
                };
            }
            return { streams: [] };
        } catch (e) {
            return { streams: [] };
        }
    }
};

module.exports = addon;
