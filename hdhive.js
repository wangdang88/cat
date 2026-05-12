// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源 - 115网盘专版，支持电视剧剧集
// @version 2.0.0
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

// 递归获取所有视频文件
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
                const subFiles = await OmniBox.getDriveFileList(shareURL, file.fid);
                if (subFiles && subFiles.files) {
                    const subVideos = await getAllVideoFiles(shareURL, subFiles.files);
                    videoFiles.push(...subVideos);
                }
            } catch (e) {
                console.log(`获取子目录失败: ${e.message}`);
            }
        }
    }
    
    return videoFiles;
}

// ========== 分类（只保留电影和电视剧）==========
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

// ========== 详情：获取资源列表，每个资源作为独立线路 ==========
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
        
        // 对于电影：直接显示资源，每个资源一个线路
        // 对于电视剧：每个资源作为线路，线路内显示网盘中的所有视频文件
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const points = res.unlock_points || 0;
            const isFree = points === 0 || res.is_free_for_user === true;
            let lineName = res.title || res.name || `资源${i + 1}`;
            lineName = lineName.replace(/[\\/:*?"<>|]/g, "");
            
            // 先解锁获取分享链接
            const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, {
                slug: res.slug,
                allow_points: true
            }, {
                headers: { "Content-Type": "application/json" },
                timeout: 30000
            });
            
            const unlockData = unlockResp.data;
            
            if (unlockData.code === "OPENAPI_COOLDOWN") {
                console.log(`[HDHive] API冷却，跳过资源: ${res.slug}`);
                continue;
            }
            
            const shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
            
            if (!shareUrl) {
                console.log(`[HDHive] 未获取到分享链接，跳过: ${res.slug}`);
                continue;
            }
            
            console.log(`[HDHive] 获取到分享链接: ${shareUrl}`);
            
            // 获取网盘文件列表
            let episodes = [];
            
            try {
                const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
                
                if (fileList && fileList.files && fileList.files.length > 0) {
                    // 获取所有视频文件
                    const videoFiles = await getAllVideoFiles(shareUrl, fileList.files);
                    
                    if (videoFiles.length > 0) {
                        // 按文件名排序
                        videoFiles.sort((a, b) => {
                            const nameA = (a.file_name || "").toLowerCase();
                            const nameB = (b.file_name || "").toLowerCase();
                            return nameA.localeCompare(nameB);
                        });
                        
                        // 构建剧集列表
                        for (let j = 0; j < videoFiles.length; j++) {
                            const file = videoFiles[j];
                            let fileName = file.file_name || `第${j + 1}集`;
                            
                            // 尝试提取集数编号
                            let episodeNum = j + 1;
                            const numMatch = fileName.match(/(\d+)/);
                            if (numMatch) {
                                episodeNum = parseInt(numMatch[1]);
                            }
                            const epMatch = fileName.match(/第(\d+)集/);
                            if (epMatch) {
                                episodeNum = parseInt(epMatch[1]);
                            }
                            
                            episodes.push({
                                name: `第${episodeNum}集 ${fileName}`,
                                playId: `${shareUrl}|${file.fid}`
                            });
                        }
                    }
                }
            } catch (e) {
                console.log(`[HDHive] 获取文件列表失败: ${e.message}`);
                // 如果获取文件失败，至少提供一个播放入口
                episodes = [{
                    name: "播放",
                    playId: shareUrl
                }];
            }
            
            if (episodes.length > 0) {
                playSources.push({
                    name: isFree ? `🎁 ${lineName}` : `💎 ${lineName} (${points}积分)`,
                    episodes: episodes
                });
            }
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
        // 解析 playId 格式：shareURL|fileId
        const parts = playId.split("|");
        let shareUrl = parts[0];
        const fileId = parts[1];
        
        // 如果没有 fileId，说明是分享链接，需要自动查找视频文件
        if (!fileId && shareUrl) {
            // 获取文件列表
            const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
            if (fileList && fileList.files) {
                const videoFiles = await getAllVideoFiles(shareUrl, fileList.files);
                if (videoFiles.length > 0) {
                    const firstVideo = videoFiles[0];
                    const firstFileId = firstVideo.fid || firstVideo.file_id;
                    if (firstFileId) {
                        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, firstFileId);
                        if (playInfo && playInfo.url && playInfo.url.length > 0) {
                            return {
                                urls: playInfo.url,
                                flag: shareUrl,
                                header: playInfo.header || {},
                                parse: playInfo.parse || 0
                            };
                        }
                    }
                }
            }
            return { urls: [], flag: shareUrl, header: {}, parse: 0 };
        }
        
        // 有 fileId，直接播放
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, fileId);
        
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0 };
        }
        
        return {
            urls: playInfo.url,
            flag: shareUrl,
            header: playInfo.header || {},
            parse: playInfo.parse || 0
        };
        
    } catch (error) {
        console.error("[HDHive] 播放错误:", error.message);
        return { urls: [], flag: flag, header: {}, parse: 0 };
    }
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
