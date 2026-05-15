// @name HDHive影视资源（115网盘专版）
// @push 1
// @author HDHive
// @description 只显示115网盘资源，每个资源作为一个线路，展示其所有视频文件作为剧集
// @version 1.1.0
// @dependencies axios

const axios = require("axios");

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

// TMDB 映射
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
        console.error("home error", error);
        return { class: buildClassTree(), list: [], filters: {} };
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
        console.error("category error", error);
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
        console.error("search error", error);
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

/**
 * 详情 - 每个115资源作为一个播放源，展示其所有视频文件作为剧集
 */
async function detail(params, context) {
    const videoId = params.videoId || "";
    if (!videoId) return { list: [] };
    const parts = videoId.split("_");
    if (parts.length < 2) return { list: [] };
    const mediaType = parts[0];
    const tmdbId = parts[1];
    try {
        const resp = await axios.get(`${BASE_URL}/api/cache/resources/${mediaType}/${tmdbId}`, { timeout: 15000 });
        const data = resp.data;
        const allResources = data.resources || [];
        const resources = allResources.filter(r => is115Resource(r));
        console.log(`[HDHive] 详情: ${mediaType}/${tmdbId}, 共${allResources.length}个资源，115资源${resources.length}个`);

        if (resources.length === 0) {
            return {
                list: [{
                    vod_id: videoId,
                    vod_name: `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId} (暂无115资源)`,
                    vod_pic: "",
                    vod_play_sources: [{ name: "📭 暂无115资源", episodes: [{ name: "该影片暂无115网盘资源", playId: "none" }] }]
                }]
            };
        }

        const playSources = [];
        const vodName = resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`;

        for (const r of resources) {
            const points = r.unlock_points || 0;
            const isFree = points === 0 || r.is_free_for_user === true;
            const sourceName = `${isFree ? "🎁 115免费" : `💎 115付费 (${points}积分)`} - ${r.title || r.name || "未命名"}`;
            let episodes = [];

            if (isFree) {
                try {
                    // 1. 解锁获取分享链接
                    const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: r.slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
                    const unlockData = unlockResp.data;
                    const shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
                    if (!shareUrl) throw new Error("未获取到分享链接");
                    console.log(`[HDHive] 资源 ${r.slug} 分享链接: ${shareUrl}`);

                    // 2. 获取文件列表（使用正确的 /api/drive/file-list）
                    const fileListResp = await axios.post(`/api/drive/file-list`, { share_url: shareUrl, path: "0" }, { timeout: 20000 });
                    const fileListData = fileListResp.data;
                    const fileList = fileListData.files || [];
                    if (fileList.length === 0) throw new Error("文件列表为空");

                    // 递归收集所有视频文件
                    const videoFiles = [];
                    async function collectFiles(files) {
                        for (const file of files) {
                            const fileName = (file.file_name || "").toLowerCase();
                            const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || fileName.endsWith(".avi") || fileName.endsWith(".mov") || fileName.endsWith(".m3u8") || fileName.endsWith(".ts");
                            if (isVideo) {
                                videoFiles.push(file);
                            }
                            if (file.dir) {
                                try {
                                    const subResp = await axios.post(`/api/drive/file-list`, { share_url: shareUrl, path: file.fid }, { timeout: 20000 });
                                    if (subResp.data && subResp.data.files) await collectFiles(subResp.data.files);
                                } catch (e) { console.warn(`获取子目录失败: ${file.fid}`); }
                            }
                        }
                    }
                    await collectFiles(fileList);
                    if (videoFiles.length === 0) throw new Error("未找到视频文件");

                    videoFiles.sort((a, b) => (a.file_name || "").localeCompare(b.file_name || ""));
                    episodes = videoFiles.map(file => ({
                        name: file.file_name || "视频",
                        playId: JSON.stringify({
                            slug: r.slug,
                            points: 0,
                            shareUrl: shareUrl,
                            fileId: file.fid || file.file_id,
                            fileName: file.file_name,
                            type: mediaType,
                            tmdbId: tmdbId
                        })
                    }));
                    console.log(`[HDHive] 资源 ${r.slug} 获取到 ${episodes.length} 个视频文件`);
                } catch (e) {
                    console.error(`获取资源 ${r.slug} 文件列表失败:`, e.message);
                    episodes = [{
                        name: "获取剧集列表失败，点击尝试播放",
                        playId: JSON.stringify({ slug: r.slug, points: 0, type: mediaType, tmdbId: tmdbId, fallback: true })
                    }];
                }
            } else {
                // 付费资源：单集
                episodes = [{
                    name: "播放",
                    playId: JSON.stringify({ slug: r.slug, points: points, type: mediaType, tmdbId: tmdbId })
                }];
            }

            playSources.push({
                name: sourceName,
                episodes: episodes
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

/**
 * 播放 - 调用后端接口获取播放地址
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
        console.log(`[HDHive] 播放: slug=${slug}, 指定文件: ${playData.fileName || '自动匹配'}`);

        let shareUrl = playData.shareUrl;
        if (!shareUrl) {
            const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
            const unlockData = unlockResp.data;
            shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
            if (!shareUrl) return { urls: [], flag: flag, header: {}, parse: 0, msg: "未获取到分享链接" };
        }
        console.log(`[HDHive] 分享链接: ${shareUrl}`);

        let fileId = playData.fileId;
        if (!fileId) {
            const fileListResp = await axios.post(`/api/drive/file-list`, { share_url: shareUrl, path: "0" }, { timeout: 20000 });
            const fileListData = fileListResp.data;
            const fileList = fileListData.files || [];
            if (fileList.length === 0) return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "网盘中没有文件" };

            async function findFirstVideoFile(files) {
                for (const file of files) {
                    const fileName = (file.file_name || "").toLowerCase();
                    const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || fileName.endsWith(".avi") || fileName.endsWith(".mov") || fileName.endsWith(".m3u8") || fileName.endsWith(".ts");
                    if (isVideo) return file;
                    if (file.dir) {
                        try {
                            const subResp = await axios.post(`/api/drive/file-list`, { share_url: shareUrl, path: file.fid }, { timeout: 20000 });
                            if (subResp.data && subResp.data.files) {
                                const found = await findFirstVideoFile(subResp.data.files);
                                if (found) return found;
                            }
                        } catch (e) {}
                    }
                }
                return null;
            }
            const videoFile = await findFirstVideoFile(fileList);
            if (!videoFile) return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "未找到视频文件" };
            fileId = videoFile.fid || videoFile.file_id;
            console.log(`[HDHive] 自动匹配视频文件: ${videoFile.file_name}`);
        }

        const playInfoResp = await axios.post(`/api/drive/video-play`, { share_url: shareUrl, file_id: fileId }, { timeout: 20000 });
        const playInfo = playInfoResp.data;
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "获取播放地址失败" };
        }

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
