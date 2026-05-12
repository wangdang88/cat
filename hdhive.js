// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源爬虫脚本，只显示115网盘资源，支持电视剧选集
// @version 1.0.8
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

const BASE_URL = "https://wd23-hdhive.hf.space";

function is115Resource(res) {
    if (res.pan_type === "115") return true;
    const link = res.link || res.download_url || res.url || res.pan_url || "";
    if (link.includes("115.com")) return true;
    const name = (res.title || res.name || "").toLowerCase();
    if (name.includes("115")) return true;
    return false;
}

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

const YEARS = Array.from({ length: 17 }, (_, i) => 2026 - i);

// 分类ID计数器
let typeIdCounter = 1;
const typeIdMap = new Map();

function getTypeId(key) {
    if (!typeIdMap.has(key)) {
        typeIdMap.set(key, String(typeIdCounter++));
    }
    return typeIdMap.get(key);
}

function buildClassTree() {
    typeIdCounter = 1;
    typeIdMap.clear();
    
    const classes = [];
    
    // 电影主分类
    const movieId = getTypeId("movie");
    classes.push({ type_id: movieId, type_name: "🎬 电影", type_pid: "0" });
    
    // 电影子分类
    for (const [id, name] of Object.entries(MOVIE_CATEGORIES)) {
        classes.push({ type_id: getTypeId(`movie_${id}`), type_name: name, type_pid: movieId });
    }
    
    // 电影地区
    const movieRegionId = getTypeId("movie_region");
    classes.push({ type_id: movieRegionId, type_name: "🌍 电影地区", type_pid: movieId });
    for (const [id, name] of Object.entries(MOVIE_REGIONS)) {
        classes.push({ type_id: getTypeId(`movie_region_${id}`), type_name: name, type_pid: movieRegionId });
    }
    
    // 电影年份
    const movieYearId = getTypeId("movie_year");
    classes.push({ type_id: movieYearId, type_name: "📅 电影年份", type_pid: movieId });
    for (const year of YEARS) {
        classes.push({ type_id: getTypeId(`movie_year_${year}`), type_name: `${year}年`, type_pid: movieYearId });
    }
    
    // 电影类型
    const movieGenreId = getTypeId("movie_genre");
    classes.push({ type_id: movieGenreId, type_name: "🎭 电影类型", type_pid: movieId });
    for (const [id, name] of Object.entries(MOVIE_GENRES)) {
        classes.push({ type_id: getTypeId(`movie_genre_${id}`), type_name: name, type_pid: movieGenreId });
    }
    
    // 电视剧主分类
    const tvId = getTypeId("tv");
    classes.push({ type_id: tvId, type_name: "📺 电视剧", type_pid: "0" });
    
    // 电视剧子分类
    for (const [id, name] of Object.entries(TV_CATEGORIES)) {
        classes.push({ type_id: getTypeId(`tv_${id}`), type_name: name, type_pid: tvId });
    }
    
    // 电视剧地区
    const tvRegionId = getTypeId("tv_region");
    classes.push({ type_id: tvRegionId, type_name: "🌍 剧集地区", type_pid: tvId });
    for (const [id, name] of Object.entries(TV_REGIONS)) {
        classes.push({ type_id: getTypeId(`tv_region_${id}`), type_name: name, type_pid: tvRegionId });
    }
    
    // 电视剧年份
    const tvYearId = getTypeId("tv_year");
    classes.push({ type_id: tvYearId, type_name: "📅 剧集年份", type_pid: tvId });
    for (const year of YEARS) {
        classes.push({ type_id: getTypeId(`tv_year_${year}`), type_name: `${year}年`, type_pid: tvYearId });
    }
    
    // 电视剧类型
    const tvGenreId = getTypeId("tv_genre");
    classes.push({ type_id: tvGenreId, type_name: "🎭 剧集类型", type_pid: tvId });
    for (const [id, name] of Object.entries(TV_GENRES)) {
        classes.push({ type_id: getTypeId(`tv_genre_${id}`), type_name: name, type_pid: tvGenreId });
    }
    
    return classes;
}

async function home(params, context) {
    try {
        const classes = buildClassTree();
        
        // 获取热门推荐
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
            vod_remarks: item.release_date ? item.release_date.slice(0, 4) : "未知"
        }));
        
        return { class: classes, list: list, filters: {} };
    } catch (error) {
        console.error("home error:", error.message);
        return { class: [], list: [], filters: {} };
    }
}

async function category(params, context) {
    const categoryId = params.categoryId || params.id || "";
    const page = Number(params.page || 1);
    
    // 根据分类ID映射回请求参数
    let type = "movie";
    let subId = "";
    
    // 解析分类ID
    if (categoryId.includes("movie")) {
        type = "movie";
        if (categoryId.includes("popular")) subId = "popular";
        else if (categoryId.includes("now_playing")) subId = "now_playing";
        else if (categoryId.includes("top_rated")) subId = "top_rated";
        else if (categoryId.includes("upcoming")) subId = "upcoming";
        else if (categoryId.includes("region")) {
            const match = categoryId.match(/region_(.+)/);
            if (match) subId = match[1];
        }
        else if (categoryId.includes("year")) {
            const match = categoryId.match(/year_(.+)/);
            if (match) subId = `movie_year_${match[1]}`;
        }
        else if (categoryId.includes("genre")) {
            const match = categoryId.match(/genre_(.+)/);
            if (match) subId = match[1];
        }
        else {
            subId = "popular";
        }
    } else if (categoryId.includes("tv")) {
        type = "tv";
        if (categoryId.includes("popular")) subId = "popular";
        else if (categoryId.includes("top_rated")) subId = "top_rated";
        else if (categoryId.includes("on_the_air")) subId = "on_the_air";
        else if (categoryId.includes("airing_today")) subId = "airing_today";
        else if (categoryId.includes("region")) {
            const match = categoryId.match(/region_(.+)/);
            if (match) subId = match[1];
        }
        else if (categoryId.includes("year")) {
            const match = categoryId.match(/year_(.+)/);
            if (match) subId = `year_${match[1]}`;
        }
        else if (categoryId.includes("genre")) {
            const match = categoryId.match(/genre_(.+)/);
            if (match) subId = match[1];
        }
        else {
            subId = "popular";
        }
    } else {
        // 默认电影热门
        type = "movie";
        subId = "popular";
    }
    
    try {
        let requestParams = { type: type, page: page };
        
        if (type === "movie") {
            if (MOVIE_CATEGORIES[subId]) {
                requestParams.category = subId;
            } else if (subId.startsWith("movie_region_")) {
                const region = subId.replace("movie_region_", "");
                requestParams.filters = { region: region };
            } else if (subId.startsWith("movie_year_")) {
                const year = parseInt(subId.replace("movie_year_", ""));
                requestParams.filters = { year: year };
            } else if (subId.startsWith("movie_genre_")) {
                const genreId = parseInt(subId.replace("movie_genre_", ""));
                requestParams.filters = { genres: [genreId] };
            } else {
                requestParams.category = "popular";
            }
        } else {
            if (TV_CATEGORIES[subId]) {
                requestParams.category = subId;
            } else if (subId.startsWith("tv_region_")) {
                const region = subId.replace("tv_region_", "");
                requestParams.filters = { region: region };
            } else if (subId.startsWith("tv_year_")) {
                const year = parseInt(subId.replace("tv_year_", ""));
                requestParams.filters = { year: year };
            } else if (subId.startsWith("tv_genre_")) {
                const genreId = parseInt(subId.replace("tv_genre_", ""));
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
            vodName = resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`;
        } else {
            vodName = `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId} (暂无115资源)`;
        }
        
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const points = res.unlock_points || 0;
            const isFree = points === 0 || res.is_free_for_user === true;
            const resourceName = (res.title || res.name || `资源${i + 1}`).replace(/\.|-/g, "");
            
            playSources.push({
                name: isFree ? `🎁 ${resourceName}` : `💎 ${resourceName} (${points}积分)`,
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
        
        console.log(`[HDHive] 解锁资源: slug=${slug}`);
        
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
        
        console.log(`[HDHive] 分享链接: ${shareUrl}`);
        
        // 让SDK自动处理
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, "0");
        
        if (!playInfo) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "获取播放信息失败" };
        }
        
        // 如果有剧集列表
        if (playInfo.episodes && playInfo.episodes.length > 0) {
            console.log(`[HDHive] SDK返回${playInfo.episodes.length}个剧集`);
            return {
                urls: [],
                flag: shareUrl,
                header: playInfo.header || {},
                parse: 1,
                episodes: playInfo.episodes
            };
        }
        
        // 直接播放
        if (playInfo.url && playInfo.url.length > 0) {
            return {
                urls: playInfo.url,
                flag: shareUrl,
                header: playInfo.header || {},
                parse: playInfo.parse || 0
            };
        }
        
        return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "无法获取播放地址" };
        
    } catch (error) {
        console.error("[HDHive] 播放错误:", error.message);
        return { urls: [], flag: flag, header: {}, parse: 0, msg: error.message };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
