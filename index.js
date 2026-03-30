// index.js (Stremio/Nuvio Entegrasyonu)
builder.defineStreamHandler(async (args) => {
    let allStreams = [];

    if (args.id.startsWith("cb_")) {
        // PornHub Tetikleyici
        const phId = args.id.replace("cb_", "");
        allStreams = await getPornHubStream(phId);
    } else {
        // SinemaCX Tetikleyici (TMDB ID ile)
        const tmdbId = args.id; 
        allStreams = await getSinemaCXStream(tmdbId, args.type);
    }

    return { streams: allStreams };
});
