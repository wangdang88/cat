// @name HDHive影视资源（稳定版）
// @push 1
// @author HDHive
// @description 115网盘资源，每个资源一条线路，点击播放自动获取第一个视频
// @version 1.2.0

const BASE_URL = "https://wd23-hdhive.hf.space";

// 安全请求函数
async function safeRequest(url, options = {}) {
    try {
        const resp = await fetch(url, options);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.error(`[HDHive] 请求失败: ${url}`, e);
        throw e;
    }
}

function is115Resource(res) {
    if (res.pan_type === "115") return true;
    const link = res.link || res.download_url || res.url || res.pan_url || "";
    if (link.includes("115.com")) return true;
    const name = (res.title || res.name || "").toLowerCase();
    if (name.includes("115")) return true;
    return false;
}

// 简化版分类树（只保留最常用的几个分类，确保能显示）
function getSimpleClassTree() {
    return [
        { type_id: "movie", type_name: "🎬 电影", type_pid: "0" },
        { type_id: "movie|popular", type_name: "🔥 热门电影", type_pid: "movie" },
        { type_id: "tv", type_name: "📺 电视剧", type_pid: "0" },
        { type_id: "tv|popular", type_name: "🔥 热门剧集", type_pid: "tv" }
    ];
}

async function home(params, context) {
    try {
        // 返回分类和首页推荐（电影前12部）
        const resp = await safeRequest(`${BASE_URL}/api/discover`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "movie", category: "popular", page: 1 })
        });
        const list = (resp.results || []).slice(0, 12).map(item => ({
            vod_id: `movie_${item.id}`,
            vod_name: item.title,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: (item.release_date || "").slice(0, 4)
        }));
        return { class: getSimpleClassTree(), list: list, filters: {} };
    } catch (e) {
        console.error("home error", e);
        return { class: getSimpleClassTree(), list: [], filters: {} };
    }
}

async function category(params, context) {
    const categoryId = params.categoryId || "movie|popular";
    const page = Number(params.page || 1);
    const parts = categoryId.split("|");
    const type = parts[0] === "tv" ? "tv" : "movie";
    try {
        const requestBody = { type: type, page: page };
        if (type === "movie") requestBody.category = "popular";
        else requestBody.category = "popular";
        const resp = await safeRequest(`${BASE_URL}/api/discover`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });
        const list = (resp.results || []).map(item => ({
            vod_id: `${type}_${item.id}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4)
        }));
        return { page: page, pagecount: resp.total_pages || 1, total: resp.total_results || list.length, list: list };
    } catch (e) {
        console.error("category error", e);
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

async function search(params, context) {
    const wd = params.keyword || params.wd || "";
    const page = Number(params.page || 1);
    if (!wd) return { page: page, pagecount: 0, total: 0, list: [] };
    try {
        const resp = await safeRequest(`${BASE_URL}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: wd, page: page })
        });
        const list = (resp.results || []).map(item => {
            const mediaType = item.media_type || (item.title ? "movie" : "tv");
            return {
                vod_id: `${mediaType}_${item.id}`,
                vod_name: item.title || item.name,
                vod_pic: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
                vod_remarks: (item.release_date || item.first_air_date || "").slice(0, 4)
            };
        });
        return { page: page, pagecount: resp.total_pages || 1, total: resp.total_results || list.length, list: list };
    } catch (e) {
        console.error("search error", e);
        return { page: page, pagecount: 0, total: 0, list: [] };
    }
}

// 详情：每个资源一个线路，每个线路只有一个“播放”按钮（点击时自动播放第一个视频）
async function detail(params, context) {
    const videoId = params.videoId || "";
    if (!videoId) return { list: [] };
    const parts = videoId.split("_");
    if (parts.length < 2) return { list: [] };
    const mediaType = parts[0];
    const tmdbId = parts[1];
    try {
        const resp = await safeRequest(`${BASE_URL}/api/cache/resources/${mediaType}/${tmdbId}`);
        const allResources = resp.resources || [];
        const resources = allResources.filter(r => is115Resource(r));
        if (resources.length === 0) {
            return {
                list: [{
                    vod_id: videoId,
                    vod_name: `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`,
                    vod_pic: "",
                    vod_play_sources: [{ name: "📭 暂无115资源", episodes: [{ name: "无资源", playId: "none" }] }]
                }]
            };
        }
        const vodName = resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`;
        const playSources = resources.map(r => {
            const points = r.unlock_points || 0;
            const isFree = points === 0 || r.is_free_for_user === true;
            const sourceName = `${isFree ? "🎁 115免费" : `💎 115付费 (${points}积分)`} - ${r.title || r.name || "未命名"}`;
            // 每个资源只有一个剧集：点击时播放
            return {
                name: sourceName,
                episodes: [{
                    name: "播放",
                    playId: JSON.stringify({ slug: r.slug, points: points, type: mediaType, tmdbId: tmdbId })
                }]
            };
        });
        return {
            list: [{
                vod_id: videoId,
                vod_name: vodName,
                vod_pic: "",
                vod_play_sources: playSources
            }]
        };
    } catch (e) {
        console.error("detail error", e);
        return { list: [] };
    }
}

// 播放：解锁获取分享链接，然后获取第一个视频文件并播放
async function play(params, context) {
    const playId = params.playId || "";
    if (!playId || playId === "none") {
        return { urls: [], msg: "无效的资源标识" };
    }
    let playData;
    try {
        playData = JSON.parse(playId);
    } catch (e) {
        playData = { slug: playId, points: 0 };
    }
    const slug = playData.slug;
    if (!slug) return { urls: [], msg: "资源标识无效" };
    try {
        // 1. 解锁获取分享链接
        const unlockData = await safeRequest(`${BASE_URL}/api/cache/unlock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: slug, allow_points: true })
        });
        const shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
        if (!shareUrl) return { urls: [], msg: "未获取到分享链接" };
        // 2. 获取文件列表
        const fileListData = await safeRequest(`/api/drive/file-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ share_url: shareUrl, path: "0" })
        });
        const files = fileListData.files || [];
        if (files.length === 0) return { urls: [], msg: "网盘无文件" };
        // 递归查找第一个视频文件
        async function findFirstVideo(filesList) {
            for (const f of filesList) {
                const name = (f.file_name || "").toLowerCase();
                const isVideo = name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".avi") || name.endsWith(".mov") || name.endsWith(".m3u8") || name.endsWith(".ts");
                if (isVideo) return f;
                if (f.dir) {
                    try {
                        const subRes = await safeRequest(`/api/drive/file-list`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ share_url: shareUrl, path: f.fid })
                        });
                        if (subRes.files) {
                            const found = await findFirstVideo(subRes.files);
                            if (found) return found;
                        }
                    } catch (e) {}
                }
            }
            return null;
        }
        const videoFile = await findFirstVideo(files);
        if (!videoFile) return { urls: [], msg: "未找到视频文件" };
        // 3. 获取播放地址
        const playInfo = await safeRequest(`/api/drive/video-play`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ share_url: shareUrl, file_id: videoFile.fid || videoFile.file_id })
        });
        if (!playInfo.url || playInfo.url.length === 0) return { urls: [], msg: "获取播放地址失败" };
        return { urls: playInfo.url, header: playInfo.header || {}, parse: playInfo.parse || 0 };
    } catch (e) {
        console.error("play error", e);
        return { urls: [], msg: e.message };
    }
}

module.exports = { home, category, search, detail, play };
const runner = require("spider_runner");
runner.run(module.exports);
