// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源爬虫脚本，只显示115网盘资源，支持电视剧剧集分组
// @version 1.0.6
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

// ========== 配置 ==========
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

// 从资源名称中提取集数
function extractEpisodeInfo(name) {
    let season = 1;
    let episode = 0;
    
    const epMatch = name.match(/第(\d+)集/);
    if (epMatch) episode = parseInt(epMatch[1]);
    
    const epMatch2 = name.match(/[Ee][Pp](\d+)/);
    if (epMatch2) episode = parseInt(epMatch2[1]);
    
    const seMatch = name.match(/[Ss](\d+)[Ee](\d+)/);
    if (seMatch) {
        season = parseInt(seMatch[1]);
        episode = parseInt(seMatch[2]);
    }
    
    return { season, episode };
}

// 从文件名中提取集数（用于匹配）
function extractEpisodeFromFilename(filename) {
    const lower = filename.toLowerCase();
    // 匹配 "第X集"
    let match = lower.match(/第(\d+)集/);
    if (match) return parseInt(match[1]);
    // 匹配 "epX" 或 "episodeX"
    match = lower.match(/ep(?:isode)?(\d+)/);
    if (match) return parseInt(match[1]);
    // 匹配 "S01E02"
    match = lower.match(/s\d+e(\d+)/);
    if (match) return parseInt(match[1]);
    return null;
}

// TMDB 类型映射（保持不变）
const MOVIE_CATEGORIES = { popular: "🔥 热门电影", now_playing: "🎬 正在热映", top_rated: "⭐ 评分最高", upcoming: "📅 即将上映" };
const TV_CATEGORIES = { popular: "🔥 热门剧集", airing_today: "📺 今日播出", on_the_air: "📡 正在播出", top_rated: "⭐ 评分最高" };
const MOVIE_REGIONS = { movie_region_cn: "🇨🇳 国产电影", movie_region_us: "🇺🇸 美国电影", movie_region_jp: "🇯🇵 日本电影", movie_region_kr: "🇰🇷 韩国电影", movie_region_uk: "🇬🇧 英国电影", movie_region_fr: "🇫🇷 法国电影", movie_region_de: "🇩🇪 德国电影" };
const TV_REGIONS = { cn: "🇨🇳 国产剧", us_eu: "🌍 欧美剧", jp: "🇯🇵 日剧", kr: "🇰🇷 韩剧", tw: "🇹🇼 台剧", hk: "🇭🇰 港剧", th: "🇹🇭 泰剧" };
const MOVIE_GENRES = { movie_genre_28: "⚔️ 动作", movie_genre_12: "🧙 冒险", movie_genre_16: "🎨 动画", movie_genre_35: "😄 喜剧", movie_genre_80: "🔫 犯罪", movie_genre_99: "📹 纪录片", movie_genre_18: "📖 剧情", movie_genre_10751: "👨‍👩‍👧 家庭", movie_genre_14: "✨ 奇幻", movie_genre_36: "📜 历史", movie_genre_27: "👻 恐怖", movie_genre_10402: "🎵 音乐", movie_genre_9648: "🕵️ 悬疑", movie_genre_10749: "💕 爱情", movie_genre_878: "🚀 科幻", movie_genre_53: "⚡ 惊悚", movie_genre_10752: "⚔️ 战争", movie_genre_37: "🤠 西部" };
const TV_GENRES = { genre_18: "📖 剧情", genre_35: "😄 喜剧", genre_10759: "⚔️ 动作冒险", genre_10765: "🚀 科幻奇幻", genre_9648: "🕵️ 悬疑", genre_10749: "💕 爱情", genre_99: "📹 纪录片", genre_16: "🎨 动画", genre_80: "🔫 犯罪", genre_10751: "👨‍👩‍👧 家庭" };
const YEARS = Array.from({ length: 17 }, (_, i) => 2026 - i);

function buildClassTree() {
    const classes = [];
    classes.push({ type_id: "movie", type_name: "🎬 电影", type_pid: "0" });
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

async function home(params, context) {
    try {
        const classes = buildClassTree();
        const resp = await axios.post(`${BASE_URL}/api/discover`, { type: "movie", category: "popular", page: 1 }, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
        const data = resp.data;
        const list = (data.results || []).slice(0, 12).map(item => ({
            vod_id: `movie_${item.id}`,
            vod_name: item.title,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: item.release_date ? item.release_date.slice(0, 4) : "未知"
        }));
        return { class: classes, list: list, filters: {} };
    } catch (error) {
        return { class: [], list: [], filters: {} };
    }
}

async function category(params, context) {
    const categoryId = params.categoryId || params.id || "movie|popular";
    const page = Number(params.page || 1);
    const parts = categoryId.split("|");
    const type = parts[0] || "movie";
    let subId = parts[1] || "popular";
    try {
        let requestParams = { type: type, page: page };
        if (type === "movie") {
            if (MOVIE_CATEGORIES[subId]) requestParams.category = subId;
            else if (MOVIE_REGIONS[subId]) requestParams.filters = { region: subId };
            else if (subId.startsWith("year_")) requestParams.filters = { year: parseInt(subId.replace("year_", "")) };
            else if (MOVIE_GENRES[subId]) requestParams.filters = { genres: [parseInt(subId.replace("movie_genre_", ""))] };
            else requestParams.category = "popular";
        } else {
            if (TV_CATEGORIES[subId]) requestParams.category = subId;
            else if (TV_REGIONS[subId]) requestParams.filters = { region: subId };
            else if (subId.startsWith("year_")) requestParams.filters = { year: parseInt(subId.replace("year_", "")) };
            else if (TV_GENRES[subId]) requestParams.filters = { genres: [parseInt(subId.replace("genre_", ""))] };
            else requestParams.category = "popular";
        }
        const resp = await axios.post(`${BASE_URL}/api/discover`, requestParams, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
        const data = resp.data;
        const list = (data.results || []).map(item => ({
            vod_id: `${type}_${item.id}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4)
        }));
        return { page: page, pagecount: data.total_pages || 1, total: data.total_results || list.length, list: list };
    } catch (error) {
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

async function search(params, context) {
    const wd = params.keyword || params.wd || "";
    const page = Number(params.page || 1);
    if (!wd) return { page: page, pagecount: 0, total: 0, list: [] };
    try {
        const resp = await axios.post(`${BASE_URL}/api/search`, { query: wd, page: page }, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
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
        return { page: page, pagecount: data.total_pages || 1, total: data.total_results || list.length, list: list };
    } catch (error) {
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

/**
 * 详情 - 只显示115网盘资源，电视剧按季分组（修复集数匹配）
 */
async function detail(params, context) {
    const videoId = params.videoId || "";
    if (!videoId) return { list: [] };
    const parts = videoId.split("_");
    if (parts.length < 2) return { list: [] };
    const mediaType = parts[0];
    const tmdbId = parts[1];
    try {
        const resp = await axios.get(`${BASE_URL}/api/cache/resources/${mediaType}/${tmdbId}`, { timeout: 30000 });
        const data = resp.data;
        const allResources = data.resources || [];
        const resources = allResources.filter(r => is115Resource(r));
        console.log(`[HDHive] 总共${allResources.length}个资源，筛选出${resources.length}个115资源`);

        const playSources = [];
        let vodName = resources.length > 0 ? (resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`) : `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId} (暂无115资源)`;

        if (mediaType === "movie") {
            const freeResources = resources.filter(r => (r.unlock_points || 0) === 0 || r.is_free_for_user === true);
            const paidResources = resources.filter(r => (r.unlock_points || 0) > 0 && !r.is_free_for_user);
            if (freeResources.length > 0) {
                playSources.push({
                    name: "🎁 115免费资源",
                    episodes: freeResources.map(r => ({
                        name: r.title || r.name || "播放",
                        playId: JSON.stringify({ slug: r.slug, points: r.unlock_points || 0, type: "movie", tmdbId: tmdbId })
                    }))
                });
            }
            if (paidResources.length > 0) {
                playSources.push({
                    name: "💎 115付费资源",
                    episodes: paidResources.map(r => ({
                        name: `${r.title || r.name || "播放"} (${r.unlock_points}积分)`,
                        playId: JSON.stringify({ slug: r.slug, points: r.unlock_points || 0, type: "movie", tmdbId: tmdbId })
                    }))
                });
            }
        } else {
            // 电视剧：提取每个资源的集数信息
            const episodes = [];
            for (const res of resources) {
                const points = res.unlock_points || 0;
                const isFree = points === 0 || res.is_free_for_user === true;
                let episodeName = res.title || res.name || `资源`;
                const { season, episode } = extractEpisodeInfo(episodeName);
                episodes.push({
                    name: episodeName,
                    season: season,
                    episode: episode,
                    points: points,
                    isFree: isFree,
                    slug: res.slug,
                    title: res.title || res.name
                });
            }
            episodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });
            // 按季分组
            const seasonMap = new Map();
            for (const ep of episodes) {
                if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, []);
                seasonMap.get(ep.season).push(ep);
            }
            for (const [season, seasonEpisodes] of seasonMap) {
                const points = seasonEpisodes[0]?.points || 0;
                const isFree = seasonEpisodes[0]?.isFree || false;
                playSources.push({
                    name: isFree ? `🎁 115第${season}季` : `💎 115第${season}季 (${points}积分)`,
                    episodes: seasonEpisodes.map(ep => ({
                        name: ep.name,
                        playId: JSON.stringify({
                            slug: ep.slug,
                            points: ep.points,
                            type: "tv",
                            tmdbId: tmdbId,
                            season: ep.season,
                            episode: ep.episode,
                            originalName: ep.name
                        })
                    }))
                });
            }
            if (playSources.length === 0 && episodes.length > 0) {
                const points = episodes[0]?.points || 0;
                const isFree = episodes[0]?.isFree || false;
                playSources.push({
                    name: isFree ? "🎁 115资源列表" : `💎 115资源列表 (${points}积分)`,
                    episodes: episodes.map(ep => ({
                        name: ep.name,
                        playId: JSON.stringify({ slug: ep.slug, points: ep.points, type: "tv", tmdbId: tmdbId, originalName: ep.name })
                    }))
                });
            }
        }

        if (playSources.length === 0) {
            playSources.push({ name: "📭 暂无115资源", episodes: [{ name: "该影片暂无115网盘资源", playId: "none" }] });
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

/**
 * 播放 - 修复电视剧集数匹配
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
        if (!slug) return { urls: [], flag: flag, header: {}, parse: 0, msg: "资源标识无效" };
        console.log(`[HDHive] 解锁115资源: slug=${slug}, 请求集数: season=${playData.season}, episode=${playData.episode}`);

        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        const data = resp.data;
        if (data.code === "OPENAPI_COOLDOWN") {
            const waitSeconds = data.retry_after_seconds || 60;
            return { urls: [], flag: flag, header: {}, parse: 0, msg: `API冷却中，请等待${waitSeconds}秒` };
        }
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        if (!shareUrl) return { urls: [], flag: flag, header: {}, parse: 0, msg: "未获取到分享链接" };
        console.log(`[HDHive] 115分享链接: ${shareUrl}`);

        // 获取网盘文件列表
        const driveInfo = await OmniBox.getDriveInfoByShareURL(shareUrl);
        const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
        if (!fileList || !fileList.files || fileList.files.length === 0) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "网盘中没有文件" };
        }

        // 递归查找视频文件，支持根据集数匹配
        const targetEpisode = playData.episode; // 目标集数（如果有）
        let selectedFile = null;

        async function findVideoFile(files, targetEp) {
            let matchedFile = null;
            for (const file of files) {
                const fileName = (file.file_name || "").toLowerCase();
                const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || fileName.endsWith(".avi") || fileName.endsWith(".mov") || fileName.endsWith(".m3u8") || fileName.endsWith(".ts");
                if (isVideo) {
                    // 如果有目标集数，尝试匹配
                    if (targetEp !== undefined && targetEp !== null) {
                        const epNum = extractEpisodeFromFilename(fileName);
                        if (epNum === targetEp) {
                            matchedFile = file;
                            break;
                        }
                    } else {
                        // 没有目标集数，取第一个视频文件
                        matchedFile = file;
                        break;
                    }
                }
                if (file.dir) {
                    try {
                        const subFiles = await OmniBox.getDriveFileList(shareUrl, file.fid);
                        if (subFiles && subFiles.files) {
                            const found = await findVideoFile(subFiles.files, targetEp);
                            if (found) {
                                matchedFile = found;
                                break;
                            }
                        }
                    } catch (e) {}
                }
            }
            return matchedFile;
        }

        // 先尝试按集数匹配
        if (targetEpisode) {
            selectedFile = await findVideoFile(fileList.files, targetEpisode);
            if (selectedFile) console.log(`[HDHive] 匹配到第${targetEpisode}集: ${selectedFile.file_name}`);
        }
        // 如果没匹配到或者没有目标集数，则取第一个视频文件
        if (!selectedFile) {
            selectedFile = await findVideoFile(fileList.files, null);
            if (selectedFile) console.log(`[HDHive] 未匹配到指定集数，使用第一个视频: ${selectedFile.file_name}`);
        }

        if (!selectedFile) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "未找到视频文件" };
        }

        const fileId = selectedFile.fid || selectedFile.file_id;
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, fileId);
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "获取播放地址失败" };
        }

        try {
            await OmniBox.addPlayHistory({
                vodId: playData.tmdbId || "",
                episode: playData.episode ? `第${playData.episode}集` : slug
            });
        } catch (e) {}

        return {
            urls: playInfo.url,
            flag: shareUrl,
            header: playInfo.header || {},
            parse: playInfo.parse || 0
        };
    } catch (error) {
        console.error("[HDHive] 播放错误:", error.message);
        return { urls: [], flag: flag, header: {}, parse: 0, msg: error.message };
    }
}

module.exports = { home, category, search, detail, play };
const runner = require("spider_runner");
runner.run(module.exports);
