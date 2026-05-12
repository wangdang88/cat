// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源 - 115网盘专版
// @version 1.0.9
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

const BASE_URL = "https://wd23-hdhive.hf.space";

// 判断是否为115网盘资源
function is115Resource(res) {
    if (res.pan_type === "115") return true;
    const link = res.link || res.download_url || res.url || res.pan_url || "";
    if (link.includes("115.com")) return true;
    const name = (res.title || res.name || "").toLowerCase();
    if (name.includes("115")) return true;
    return false;
}

// ========== 首页 ==========
async function home(params, context) {
    const classes = [
        { type_id: "movie", type_name: "🎬 电影", type_pid: "0" },
        { type_id: "tv", type_name: "📺 电视剧", type_pid: "0" }
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

// ========== 分类 ==========
async function category(params, context) {
    const categoryId = params.categoryId || params.id || "movie";
    const page = Number(params.page || 1);
    
    let type = "movie";
    if (categoryId === "tv") {
        type = "tv";
    }
    
    try {
        const resp = await axios.post(`${BASE_URL}/api/discover`, {
            type: type,
            category: "popular",
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

// ========== 搜索 ==========
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

// ========== 详情 ==========
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
        const allResources = data.resources || [];
        
        // 只保留115网盘资源
        const resources = allResources.filter(r => is115Resource(r));
        
        console.log(`[HDHive] 总共${allResources.length}个资源，筛选出${resources.length}个115资源`);
        
        const playSources = [];
        let vodName = "";
        
        if (resources.length > 0) {
            vodName = resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"}`;
        } else {
            vodName = `${mediaType === "movie" ? "电影" : "电视剧"} (暂无115资源)`;
        }
        
        // 每个资源作为一个独立线路
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const points = res.unlock_points || 0;
            const isFree = points === 0 || res.is_free_for_user === true;
            let lineName = res.title || res.name || `线路${i + 1}`;
            // 清理名称中的特殊字符
            lineName = lineName.replace(/[\\/:*?"<>|]/g, "");
            
            playSources.push({
                name: isFree ? `🎁 ${lineName}` : `💎 ${lineName} (${points}积分)`,
                episodes: [{
                    name: "播放",
                    playId: JSON.stringify({
                        slug: res.slug,
                        points: points,
                        type: mediaType,
                        tmdbId: tmdbId
                    })
                }]
            });
        }
        
        if (playSources.length === 0) {
            playSources.push({
                name: "📭 暂无115资源",
                episodes: [{ name: "该影片暂无115网盘资源", playId: "none" }]
            });
        }
        
        return {
            list: [{
                vod_id: videoId,
                vod_name: vodName,
                vod_pic: "",
                vod_play_sources: playSources
            }]
        };
    } catch (error) {
        console.error("detail error:", error.message);
        return { list: [] };
    }
}

// ========== 播放 ==========
async function play(params, context) {
    const playId = params.playId || "";
    const flag = params.flag || "";
    
    if (!playId || playId === "none") {
        return { urls: [], flag: flag, header: {}, parse: 0 };
    }
    
    try {
        let playData;
        try {
            playData = JSON.parse(playId);
        } catch (e) {
            playData = { slug: playId, points: 0 };
        }
        
        const slug = playData.slug;
        
        if (!slug) {
            return { urls: [], flag: flag, header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 解锁资源: ${slug}`);
        
        // 调用解锁接口获取分享链接
        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, {
            slug: slug,
            allow_points: true
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });
        
        const data = resp.data;
        
        if (data.code === "OPENAPI_COOLDOWN") {
            return { urls: [], flag: flag, header: {}, parse: 0 };
        }
        
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (!shareUrl) {
            return { urls: [], flag: flag, header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 分享链接: ${shareUrl}`);
        
        // 让SDK自动处理，获取播放信息（包括电视剧剧集列表）
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, "0");
        
        if (!playInfo) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0 };
        }
        
        // 如果有剧集列表（电视剧），返回剧集列表
        if (playInfo.episodes && playInfo.episodes.length > 0) {
            console.log(`[HDHive] 获取到${playInfo.episodes.length}个剧集`);
            return {
                urls: [],
                flag: shareUrl,
                header: playInfo.header || {},
                parse: 1,
                episodes: playInfo.episodes
            };
        }
        
        // 直接播放（电影）
        if (playInfo.url && playInfo.url.length > 0) {
            return {
                urls: playInfo.url,
                flag: shareUrl,
                header: playInfo.header || {},
                parse: playInfo.parse || 0
            };
        }
        
        return { urls: [], flag: shareUrl, header: {}, parse: 0 };
        
    } catch (error) {
        console.error("[HDHive] 播放错误:", error.message);
        return { urls: [], flag: flag, header: {}, parse: 0 };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
