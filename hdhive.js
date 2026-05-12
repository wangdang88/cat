// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源 - 支持网盘分享链接解析获取直链
// @version 1.0.4
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

// 你的 Hugging Face Space 地址
const BASE_URL = "https://wd23-hdhive.hf.space";

/**
 * 递归获取所有视频文件
 */
async function getAllVideoFiles(shareURL, files) {
    const videoFiles = [];
    
    for (const file of files) {
        // 检查是否是视频文件
        const fileName = (file.file_name || "").toLowerCase();
        const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || 
                        fileName.endsWith(".avi") || fileName.endsWith(".mov") ||
                        fileName.endsWith(".m3u8") || fileName.endsWith(".ts") ||
                        fileName.endsWith(".webm") || fileName.endsWith(".flv");
        
        if (isVideo) {
            videoFiles.push(file);
        } else if (file.dir) {
            // 是目录，递归获取
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
 * 首页（可选）
 */
async function home(params, context) {
    return { class: [], list: [], filters: {} };
}

/**
 * 分类（可选）
 */
async function category(params, context) {
    return { page: 1, pagecount: 0, total: 0, list: [] };
}

/**
 * 搜索（可选）
 */
async function search(params, context) {
    return { page: 1, pagecount: 0, total: 0, list: [] };
}

/**
 * 详情 - 从 HDHive 获取资源列表
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
        
        for (const res of resources) {
            const points = res.unlock_points || 0;
            const isFree = points === 0 || res.is_free_for_user === true;
            
            playSources.push({
                name: isFree ? `🎁 ${res.title || res.name || "资源"}` : `💎 ${res.title || res.name || "资源"} (${points}积分)`,
                episodes: [{
                    name: "播放",
                    playId: JSON.stringify({
                        slug: res.slug,
                        points: points
                    })
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
    const playId = params.playId || "";
    const flag = params.flag || "";
    
    console.log(`[HDHive] 播放请求 playId: ${playId}`);
    
    if (!playId || playId === "none") {
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
    
    try {
        // 解析 playId 获取 slug
        let slug;
        if (playId.startsWith("{")) {
            const parsed = JSON.parse(playId);
            slug = parsed.slug;
        } else {
            slug = playId;
        }
        
        console.log(`[HDHive] 解锁 slug: ${slug}`);
        
        // 1. 调用 HDHive 解锁接口，获取网盘分享链接
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
        
        // 获取分享链接
        const shareURL = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
        
        if (!shareURL) {
            console.log(`[HDHive] 未获取到分享链接`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 分享链接: ${shareURL}`);
        
        // 2. 获取网盘信息
        const driveInfo = await OmniBox.getDriveInfoByShareURL(shareURL);
        console.log(`[HDHive] 网盘类型: ${driveInfo.driveType}`);
        
        // 3. 获取文件列表
        const fileList = await OmniBox.getDriveFileList(shareURL, "0");
        
        if (!fileList || !fileList.files || fileList.files.length === 0) {
            console.log(`[HDHive] 文件列表为空`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        // 4. 递归获取所有视频文件
        const videoFiles = await getAllVideoFiles(shareURL, fileList.files);
        
        if (videoFiles.length === 0) {
            console.log(`[HDHive] 未找到视频文件`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 找到 ${videoFiles.length} 个视频文件`);
        
        // 5. 获取第一个视频文件的播放信息
        const firstVideo = videoFiles[0];
        const fileId = firstVideo.fid || firstVideo.file_id;
        
        console.log(`[HDHive] 播放文件: ${firstVideo.file_name}, fileId: ${fileId}`);
        
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareURL, fileId, flag);
        
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            console.log(`[HDHive] 获取播放信息失败`);
            return { urls: [], flag: "", header: {}, parse: 0 };
        }
        
        console.log(`[HDHive] 获取到 ${playInfo.url.length} 个播放地址`);
        
        return {
            urls: playInfo.url,
            flag: shareURL,
            header: playInfo.header || {},
            parse: playInfo.parse || 0
        };
        
    } catch (error) {
        console.error(`[HDHive] 播放错误:`, error.message);
        if (error.response) {
            console.error(`状态码: ${error.response.status}`);
        }
        return { urls: [], flag: "", header: {}, parse: 0 };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
