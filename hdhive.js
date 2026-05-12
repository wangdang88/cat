// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源 - 推送网盘链接到SDK
// @version 1.0.7
// @dependencies axios

const axios = require("axios");

const BASE_URL = "https://wd23-hdhive.hf.space";

/**
 * 首页
 */
async function home(params, context) {
    const classes = [
        { type_id: "movie", type_name: "🎬 电影" },
        { type_id: "tv", type_name: "📺 电视剧" }
    ];
    
    try {
        const resp = await axios.post(`${BASE_URL}/api/discover`, {
            type: "movie",
            category: "popular",
            page: 1
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
        });
        
        const data = resp.data;
        const list = (data.results || []).slice(0, 12).map(item => ({
            vod_id: `movie_${item.id}`,
            vod_name: item.title,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: item.release_date ? item.release_date.slice(0, 4) : ""
        }));
        
        return { class: classes, list: list, filters: {} };
    } catch (error) {
        return { class: classes, list: [], filters: {} };
    }
}

/**
 * 分类
 */
async function category(params, context) {
    const categoryId = params.categoryId || params.id || "movie";
    const page = Number(params.page || 1);
    
    let type = "movie";
    let category = "popular";
    
    if (categoryId === "tv") {
        type = "tv";
        category = "popular";
    }
    
    try {
        const resp = await axios.post(`${BASE_URL}/api/discover`, {
            type: type,
            category: category,
            page: page
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
        });
        
        const data = resp.data;
        const list = (data.results || []).map(item => ({
            vod_id: `${type}_${item.id}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4)
        }));
        
        return {
            page: page,
            pagecount: data.total_pages || 1,
            total: data.total_results || list.length,
            list: list
        };
    } catch (error) {
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

/**
 * 搜索
 */
async function search(params, context) {
    const wd = params.keyword || params.wd || "";
    const page = Number(params.page || 1);
    
    if (!wd) {
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
    
    try {
        const resp = await axios.post(`${BASE_URL}/api/search`, {
            query: wd,
            page: page
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
        });
        
        const data = resp.data;
        const list = (data.results || []).map(item => {
            const mediaType = item.media_type || (item.title ? "movie" : "tv");
            return {
                vod_id: `${mediaType}_${item.id}`,
                vod_name: item.title || item.name,
                vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
                vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4)
            };
        });
        
        return {
            page: page,
            pagecount: data.total_pages || 1,
            total: data.total_results || list.length,
            list: list
        };
    } catch (error) {
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

/**
 * 详情 - 获取资源列表
 */
async function detail(params, context) {
    const videoId = params.videoId || "";
    
    if (!videoId) {
        return { list: [] };
    }
    
    const parts = videoId.split("_");
    if (parts.length < 2) {
        return { list: [] };
    }
    
    const mediaType = parts[0];
    const tmdbId = parts[1];
    
    try {
        const resp = await axios.get(`${BASE_URL}/api/cache/resources/${mediaType}/${tmdbId}`, {
            timeout: 30000
        });
        
        const data = resp.data;
        const resources = data.resources || [];
        
        const playSources = [];
        
        for (const res of resources) {
            const points = res.unlock_points || 0;
            const isFree = points === 0 || res.is_free_for_user === true;
            
            playSources.push({
                name: isFree ? `🎁 ${res.title || res.name || "资源"}` : `💎 ${res.title || res.name || "资源"} (${points}积分)`,
                episodes: [{
                    name: "播放",
                    playId: res.slug  // 传递 slug，播放时解锁获取分享链接
                }]
            });
        }
        
        if (playSources.length === 0) {
            playSources.push({
                name: "📭 暂无资源",
                episodes: [{ name: "无可用资源", playId: "none" }]
            });
        }
        
        return {
            list: [{
                vod_id: videoId,
                vod_name: `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`,
                vod_pic: "",
                vod_play_sources: playSources
            }]
        };
        
    } catch (error) {
        return { list: [] };
    }
}

/**
 * 播放 - 解锁获取网盘分享链接，推送给SDK
 */
async function play(params, context) {
    const slug = params.playId || "";
    
    if (!slug || slug === "none") {
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
    
    try {
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
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        // 获取网盘分享链接
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (!shareUrl) {
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        // 直接返回分享链接，让 OmniBox SDK 处理
        // 注意：这里不是返回播放地址，而是返回网盘分享链接
        // OmniBox 会自动识别并解析
        return {
            urls: [{ name: "播放", url: shareUrl }],
            flag: shareUrl,
            header: {},
            parse: 0
        };
        
    } catch (error) {
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
