// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源 - 完整版
// @version 1.0.5
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

// 你的 Hugging Face Space 地址
const BASE_URL = "https://wd23-hdhive.hf.space";

// ========== 分类配置 ==========
const MOVIE_CATEGORIES = [
    { id: "popular", name: "🔥 热门电影" },
    { id: "now_playing", name: "🎬 正在热映" },
    { id: "top_rated", name: "⭐ 评分最高" },
    { id: "upcoming", name: "📅 即将上映" }
];

const TV_CATEGORIES = [
    { id: "popular", name: "🔥 热门剧集" },
    { id: "airing_today", name: "📺 今日播出" },
    { id: "on_the_air", name: "📡 正在播出" },
    { id: "top_rated", name: "⭐ 评分最高" }
];

/**
 * 首页 - 返回分类列表和推荐
 */
async function home(params, context) {
    try {
        // 构建分类树
        const classes = [
            { type_id: "movie", type_name: "🎬 电影", type_pid: "0" },
            { type_id: "tv", type_name: "📺 电视剧", type_pid: "0" }
        ];
        
        // 添加电影子分类
        for (const cat of MOVIE_CATEGORIES) {
            classes.push({ type_id: `movie_${cat.id}`, type_name: cat.name, type_pid: "movie" });
        }
        
        // 添加电视剧子分类
        for (const cat of TV_CATEGORIES) {
            classes.push({ type_id: `tv_${cat.id}`, type_name: cat.name, type_pid: "tv" });
        }
        
        // 获取首页推荐（热门电影）
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
        console.error("home error:", error.message);
        return { class: [], list: [], filters: {} };
    }
}

/**
 * 分类 - 获取指定分类的影片列表
 */
async function category(params, context) {
    const categoryId = params.categoryId || params.id || "movie_popular";
    const page = Number(params.page || 1);
    
    // 解析分类ID：格式为 movie_popular 或 tv_popular
    const parts = categoryId.split("_");
    const type = parts[0] || "movie";
    const catId = parts[1] || "popular";
    
    try {
        const resp = await axios.post(`${BASE_URL}/api/discover`, {
            type: type,
            category: catId,
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
        console.error("category error:", error.message);
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
        console.error("search error:", error.message);
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

/**
 * 递归获取所有视频文件
 */
async function getAllVideoFiles(shareURL, files) {
    const videoFiles = [];
    
    for (const file of files) {
        const fileName = (file.file_name || "").toLowerCase();
        const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || 
                        fileName.endsWith(".avi") || fileName.endsWith(".mov") ||
                        fileName.endsWith(".m3u8") || fileName.endsWith(".ts") ||
                        fileName.endsWith(".webm") || fileName.endsWith(".flv");
        
        if (isVideo) {
            videoFiles.push(file);
        } else if (file.dir) {
            try {
                const subFileList = await OmniBox.getDriveFileList(shareURL, file.fid);
                if (subFileList && subFileList.files) {
                    const subVideos = await getAllVideoFiles(shareURL, subFileList.files);
                    videoFiles.push(...subVideos);
                }
            } catch (error) {
                console.log(`获取子目录失败: ${error.message}`);
            }
        }
    }
    
    return videoFiles;
}

/**
 * 详情 - 获取影片资源列表
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
                    playId: res.slug  // 直接用 slug 作为 playId
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
        console.error("detail error:", error.message);
        return { list: [] };
    }
}

/**
 * 播放 - 解锁并获取直链
 */
async function play(params, context) {
    const slug = params.playId || "";
    
    console.log(`[HDHive] 播放 slug: ${slug}`);
    
    if (!slug || slug === "none") {
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
    
    try {
        // 1. 调用解锁接口获取分享链接
        const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, {
            slug: slug,
            allow_points: true
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });
        
        const unlockData = unlockResp.data;
        
        if (unlockData.code === "OPENAPI_COOLDOWN") {
            console.log(`[HDHive] API 冷却中`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        const shareURL = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
        
        if (!shareURL) {
            console.log(`[HDHive] 未获取到分享链接`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 分享链接: ${shareURL}`);
        
        // 2. 获取文件列表
        const fileList = await OmniBox.getDriveFileList(shareURL, "0");
        
        if (!fileList || !fileList.files || fileList.files.length === 0) {
            console.log(`[HDHive] 文件列表为空`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        // 3. 获取所有视频文件
        const videoFiles = await getAllVideoFiles(shareURL, fileList.files);
        
        if (videoFiles.length === 0) {
            console.log(`[HDHive] 未找到视频文件`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        // 4. 播放第一个视频文件
        const firstVideo = videoFiles[0];
        const fileId = firstVideo.fid || firstVideo.file_id;
        
        console.log(`[HDHive] 播放: ${firstVideo.file_name}`);
        
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareURL, fileId);
        
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            console.log(`[HDHive] 获取播放信息失败`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        return {
            urls: playInfo.url,
            flag: shareURL,
            header: playInfo.header || {},
            parse: playInfo.parse || 0
        };
        
    } catch (error) {
        console.error(`[HDHive] 播放错误:`, error.message);
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
