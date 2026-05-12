/**
 * 播放 - 解锁获取网盘链接，让SDK自动处理剧集列表
 */
async function play(params, context) {
    const playId = params.playId || "";
    const flag = params.flag || "";
    
    if (!playId || playId === "none") {
        return { urls: [], flag: flag, header: {}, parse: 0, msg: "无效的资源标识" };
    }
    
    try {
        let playData;
        try {
            playData = JSON.parse(playId);
        } catch (e) {
            playData = { slug: playId, points: 0, type: "free" };
        }
        
        const slug = playData.slug;
        
        if (!slug) {
            return { urls: [], flag: flag, header: {}, parse: 0, msg: "资源标识无效" };
        }
        
        console.log(`[HDHive] 解锁115资源: slug=${slug}`);
        
        // 调用解锁接口，获取网盘分享链接
        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, {
            slug: slug,
            allow_points: true
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });
        
        const data = resp.data;
        
        if (data.code === "OPENAPI_COOLDOWN") {
            const waitSeconds = data.retry_after_seconds || 60;
            return { urls: [], flag: flag, header: {}, parse: 0, msg: `API冷却中，请等待${waitSeconds}秒` };
        }
        
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (!shareUrl) {
            return { urls: [], flag: flag, header: {}, parse: 0, msg: "未获取到分享链接" };
        }
        
        console.log(`[HDHive] 115分享链接: ${shareUrl}`);
        
        // 让SDK自动处理：获取分享信息、文件列表、刮削、播放信息
        // SDK会自动处理剧集列表，不需要我们手动构建
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, "0");
        
        if (!playInfo) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "获取播放信息失败" };
        }
        
        // 如果有剧集列表，SDK会返回episodes字段
        if (playInfo.episodes && playInfo.episodes.length > 0) {
            console.log(`[HD
