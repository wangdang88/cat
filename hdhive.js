// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源爬虫脚本，支持电影/电视剧浏览、搜索、资源获取，支持播放解锁
// @version 1.0.1
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

// ========== 配置 ==========
// 请将下面的地址替换为你的 Hugging Face Space 实际地址
const BASE_URL = "https://wd23-hdhive.hf.space";  // ← 修改这里为你的实际地址

// TMDB 类型映射
const MOVIE_CATEGORIES = {
    popular: "🔥 热门电影",
    now_playing: "🎬 正在热映",
    top_rated: "⭐ 评分最高",
    upcoming: "📅 即将上映"
};

const TV_CATEGORIES = {
    popular: "🔥 热门剧集",
    airing_today: "📺 今日播出",
    on_the_air: "📡 正在播出",
    top_rated: "⭐ 评分最高"
};

// 地区映射
const MOVIE_REGIONS = {
    movie_region_cn: "🇨🇳 国产电影",
    movie_region_us: "🇺🇸 美国电影",
    movie_region_jp: "🇯🇵 日本电影",
    movie_region_kr: "🇰🇷 韩国电影",
    movie_region_uk: "🇬🇧 英国电影",
    movie_region_fr: "🇫🇷 法国电影",
    movie_region_de: "🇩🇪 德国电影"
};

const TV_REGIONS = {
    cn: "🇨🇳 国产剧",
    us_eu: "🌍 欧美剧",
    jp: "🇯🇵 日剧",
    kr: "🇰🇷 韩剧",
    tw: "🇹🇼 台剧",
    hk: "🇭🇰 港剧",
    th: "🇹🇭 泰剧"
};

// 类型映射（电影）
const MOVIE_GENRES = {
    movie_genre_28: "⚔️ 动作",
    movie_genre_12: "🧙 冒险",
    movie_genre_16: "🎨 动画",
    movie_genre_35: "😄 喜剧",
    movie_genre_80: "🔫 犯罪",
    movie_genre_99: "📹 纪录片",
    movie_genre_18: "📖 剧情",
    movie_genre_10751: "👨‍👩‍👧 家庭",
    movie_genre_14: "✨ 奇幻",
    movie_genre_36: "📜 历史",
    movie_genre_27: "👻 恐怖",
    movie_genre_10402: "🎵 音乐",
    movie_genre_9648: "🕵️ 悬疑",
    movie_genre_10749: "💕 爱情",
    movie_genre_878: "🚀 科幻",
    movie_genre_53: "⚡ 惊悚",
    movie_genre_10752: "⚔️ 战争",
    movie_genre_37: "🤠 西部"
};

// 电视剧类型映射
const TV_GENRES = {
    genre_18: "📖 剧情",
    genre_35: "😄 喜剧",
    genre_10759: "⚔️ 动作冒险",
    genre_10765: "🚀 科幻奇幻",
    genre_9648: "🕵️ 悬疑",
    genre_10749: "💕 爱情",
    genre_99: "📹 纪录片",
    genre_16: "🎨 动画",
    genre_80: "🔫 犯罪",
    genre_10751: "👨‍👩‍👧 家庭"
};

// 年份范围
const YEARS = Array.from({ length: 17 }, (_, i) => 2026 - i);

// 构建完整分类树
function buildClassTree() {
    const classes = [];
    
    // 电影分类
    classes.push({ type_id: "movie", type_name: "🎬 电影", type_pid: "0" });
    
    // 电影子分类
    for (const [id, name] of Object.entries(MOVIE_CATEGORIES)) {
        classes.push({ type_id: `movie|${id}`, type_name: name, type_pid: "movie" });
    }
    
    classes.push({ type_id: "movie_region", type_name: "🌍 电影地区", type_pid: "movie" });
    for (const [id, name] of Object.entries(MOVIE_REGIONS)) {
        classes.push({ type_id: `movie|${id}`, type_name: name, type_pid: "movie_region" });
    }
    
    classes.push({ type_id: "movie_year", type_name: "📅 电影年份", type_pid: "movie" });
    for (const year of YEARS) {
        classes.push({ type_id: `movie|year_${year}`, type_name: `${year}年`, type_pid: "movie_year" });
    }
    
    classes.push({ type_id: "movie_genre", type_name: "🎭 电影类型", type_pid: "movie" });
    for (const [id, name] of Object.entries(MOVIE_GENRES)) {
        classes.push({ type_id: `movie|${id}`, type_name: name, type_pid: "movie_genre" });
    }
    
    // 电视剧分类
    classes.push({ type_id: "tv", type_name: "📺 电视剧", type_pid: "0" });
    
    for (const [id, name] of Object.entries(TV_CATEGORIES)) {
        classes.push({ type_id: `tv|${id}`, type_name: name, type_pid: "tv" });
    }
    
    classes.push({ type_id: "tv_region", type_name: "🌍 剧集地区", type_pid: "tv" });
    for (const [id, name] of Object.entries(TV_REGIONS)) {
        classes.push({ type_id: `tv|${id}`, type_name: name, type_pid: "tv_region" });
    }
    
    classes.push({ type_id: "tv_year", type_name: "📅 剧集年份", type_pid: "tv" });
    for (const year of YEARS) {
        classes.push({ type_id: `tv|year_${year}`, type_name: `${year}年`, type_pid: "tv_year" });
    }
    
    classes.push({ type_id: "tv_genre", type_name: "🎭 剧集类型", type_pid: "tv" });
    for (const [id, name] of Object.entries(TV_GENRES)) {
        classes.push({ type_id: `tv|${id}`, type_name: name, type_pid: "tv_genre" });
    }
    
    return classes;
}

/**
 * 首页 - 返回分类列表和推荐
 */
async function home(params, context) {
    try {
        const classes = buildClassTree();
        
        // 获取热门推荐（热门电影）
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
            vod_remarks: item.release_date ? item.release_date.slice(0, 4) : "未知",
            vod_year: item.release_date ? item.release_date.slice(0, 4) : ""
        }));
        
        return {
            class: classes,
            list: list,
            filters: {}
        };
    } catch (error) {
        console.error("home error:", error.message);
        return { class: [], list: [], filters: {} };
    }
}

/**
 * 分类 - 支持电影和电视剧的多种筛选
 */
async function category(params, context) {
    const categoryId = params.categoryId || params.id || "movie|popular";
    const page = Number(params.page || 1);
    
    const parts = categoryId.split("|");
    const type = parts[0] || "movie";
    let subId = parts[1] || "popular";
    
    try {
        let requestParams = { type: type, page: page };
        
        if (type === "movie") {
            if (MOVIE_CATEGORIES[subId]) {
                requestParams.category = subId;
            } else if (MOVIE_REGIONS[subId]) {
                requestParams.filters = { region: subId };
            } else if (subId.startsWith("year_")) {
                const year = subId.replace("year_", "");
                requestParams.filters = { year: parseInt(year) };
            } else if (MOVIE_GENRES[subId]) {
                const genreId = parseInt(subId.replace("movie_genre_", ""));
                requestParams.filters = { genres: [genreId] };
            } else {
                requestParams.category = "popular";
            }
        } else {
            if (TV_CATEGORIES[subId]) {
                requestParams.category = subId;
            } else if (TV_REGIONS[subId]) {
                requestParams.filters = { region: subId };
            } else if (subId.startsWith("year_")) {
                const year = subId.replace("year_", "");
                requestParams.filters = { year: parseInt(year) };
            } else if (TV_GENRES[subId]) {
                const genreId = parseInt(subId.replace("genre_", ""));
                requestParams.filters = { genres: [genreId] };
            } else {
                requestParams.category = "popular";
            }
        }
        
        const resp = await axios.post(`${BASE_URL}/api/discover`, requestParams, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
        });
        
        const data = resp.data;
        const list = (data.results || []).map(item => ({
            vod_id: `${type}_${item.id}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4),
            vod_year: (item.release_date || item.first_air_date || "").slice(0, 4)
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
                vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4),
                vod_year: (item.release_date || item.first_air_date || "").slice(0, 4)
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
 * 详情 - 获取影片详情和播放源
 * videoId 格式：movie_123 或 tv_456
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
        // 获取资源列表
        const resp = await axios.get(`${BASE_URL}/api/cache/resources/${mediaType}/${tmdbId}`, {
            timeout: 30000
        });
        
        const data = resp.data;
        const resources = data.resources || [];
        
        // 构建播放源
        const playSources = [];
        
        // 按免费/付费分类
        const freeResources = resources.filter(r => (r.unlock_points || 0) === 0 || r.is_free_for_user === true);
        const paidResources = resources.filter(r => (r.unlock_points || 0) > 0 && !r.is_free_for_user);
        
        // 获取影片基本信息
        let vodName = "";
        let vodContent = "";
        
        if (resources.length > 0) {
            const firstResource = resources[0];
            if (firstResource.title) {
                vodName = firstResource.title;
            } else if (firstResource.name) {
                vodName = firstResource.name;
            }
            vodContent = `共 ${resources.length} 个资源`;
        }
        
        if (vodName === "") {
            vodName = `${mediaType === "movie" ? "电影" : "电视剧"} ID: ${tmdbId}`;
        }
        
        // 使用 OmniBox SDK 生成唯一播放标识
        if (freeResources.length > 0) {
            playSources.push({
                name: "🎁 免费资源",
                episodes: freeResources.map(r => ({
                    name: r.title || r.name || "资源",
                    playId: JSON.stringify({
                        slug: r.slug,
                        points: r.unlock_points || 0,
                        type: "free",
                        tmdbId: tmdbId,
                        mediaType: mediaType
                    })
                }))
            });
        }
        
        if (paidResources.length > 0) {
            playSources.push({
                name: "💎 付费资源",
                episodes: paidResources.map(r => ({
                    name: `${r.title || r.name || "资源"} (${r.unlock_points || 0}积分)`,
                    playId: JSON.stringify({
                        slug: r.slug,
                        points: r.unlock_points || 0,
                        type: "paid",
                        tmdbId: tmdbId,
                        mediaType: mediaType
                    })
                }))
            });
        }
        
        if (playSources.length === 0) {
            playSources.push({
                name: "📭 暂无资源",
                episodes: [{
                    name: "该影片暂无可用资源",
                    playId: "none"
                }]
            });
        }
        
        return {
            list: [{
                vod_id: videoId,
                vod_name: vodName,
                vod_pic: "",
                vod_content: vodContent,
                vod_play_sources: playSources
            }]
        };
    } catch (error) {
        console.error("detail error:", error.message);
        return {
            list: [{
                vod_id: videoId,
                vod_name: "获取失败",
                vod_content: error.message,
                vod_play_sources: []
            }]
        };
    }
}

/**
 * 播放 - 解锁资源获取真实播放地址
 */
async function play(params, context) {
    const playId = params.playId || "";
    const flag = params.flag || "";
    
    if (!playId || playId === "none") {
        return {
            urls: [],
            flag: flag,
            header: {},
            parse: 0,
            msg: "无效的资源标识"
        };
    }
    
    try {
        // 解析 playId
        let playData;
        try {
            playData = JSON.parse(playId);
        } catch (e) {
            // 如果不是 JSON，尝试作为纯 slug 处理
            playData = { slug: playId, points: 0, type: "free" };
        }
        
        const slug = playData.slug;
        const points = playData.points || 0;
        
        if (!slug) {
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: "资源标识无效"
            };
        }
        
        console.log(`解锁资源: slug=${slug}, points=${points}`);
        
        // 调用解锁接口
        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, {
            slug: slug,
            allow_points: true
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });
        
        const data = resp.data;
        
        // 检查 API 冷却
        if (data.code === "OPENAPI_COOLDOWN") {
            const waitSeconds = data.retry_after_seconds || 60;
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: `API 冷却中，请等待 ${waitSeconds} 秒后再试`
            };
        }
        
        // 提取真实链接
        const link = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (link) {
            console.log(`解锁成功: ${link}`);
            // 添加播放历史记录
            try {
                await OmniBox.addPlayHistory({
                    vodId: playData.tmdbId || "",
                    title: playData.title || "",
                    episode: slug
                });
            } catch (e) {
                // 忽略历史记录错误
            }
            
            return {
                urls: [{ name: "播放", url: link }],
                flag: flag,
                header: {},
                parse: 0
            };
        } else {
            const errorMsg = data.error || data.msg || "解锁失败，未获取到链接";
            console.error(`解锁失败: ${errorMsg}`);
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: errorMsg
            };
        }
    } catch (error) {
        console.error("play error:", error.message);
        if (error.response) {
            console.error("响应状态:", error.response.status);
            console.error("响应数据:", error.response.data);
        }
        return {
            urls: [],
            flag: flag,
            header: {},
            parse: 0,
            msg: error.message
        };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
