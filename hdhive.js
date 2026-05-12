// @name HDHive影视资源
// @push 1
// @author HDHive
// @description HDHive影视资源爬虫脚本，支持电影/电视剧浏览、搜索、资源获取，支持播放解锁
// @version 1.0.3
// @dependencies axios

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

const BASE_URL = "https://wd23-hdhive.hf.space";

// ... 前面的配置保持不变 ...

/**
 * 详情 - 获取影片详情和播放源（支持电视剧剧集）
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
        
        // 获取影片基本信息（从TMDB获取更详细的信息）
        let vodName = "";
        let vodPic = "";
        let vodContent = "";
        let vodYear = "";
        
        try {
            // 尝试获取TMDB详细信息
            let tmdbUrl = "";
            if (mediaType === "movie") {
                tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`;
            } else {
                tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`;
            }
            // 注意：TMDB_API_KEY 需要在环境变量中配置
            // 如果没有配置，可以跳过
        } catch (e) {
            // 忽略
        }
        
        if (vodName === "") {
            vodName = `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`;
        }
        
        // 构建播放源
        const playSources = [];
        
        if (mediaType === "movie") {
            // 电影：直接显示资源列表
            const freeResources = resources.filter(r => (r.unlock_points || 0) === 0 || r.is_free_for_user === true);
            const paidResources = resources.filter(r => (r.unlock_points || 0) > 0 && !r.is_free_for_user);
            
            if (freeResources.length > 0) {
                playSources.push({
                    name: "🎁 免费资源",
                    episodes: freeResources.map(r => ({
                        name: r.title || r.name || "播放",
                        playId: JSON.stringify({
                            slug: r.slug,
                            points: r.unlock_points || 0,
                            type: "movie",
                            tmdbId: tmdbId,
                            title: r.title || r.name || ""
                        })
                    }))
                });
            }
            
            if (paidResources.length > 0) {
                playSources.push({
                    name: "💎 付费资源",
                    episodes: paidResources.map(r => ({
                        name: `${r.title || r.name || "播放"} (${r.unlock_points}积分)`,
                        playId: JSON.stringify({
                            slug: r.slug,
                            points: r.unlock_points || 0,
                            type: "movie",
                            tmdbId: tmdbId,
                            title: r.title || r.name || ""
                        })
                    }))
                });
            }
        } else {
            // 电视剧：需要按季和集组织
            // 假设资源名称中包含集数信息，如 "第1集"、"EP01" 等
            const episodes = [];
            
            for (const res of resources) {
                const points = res.unlock_points || 0;
                const isFree = points === 0 || res.is_free_for_user === true;
                let episodeName = res.title || res.name || "资源";
                
                // 尝试从名称中提取集数
                let episodeNum = 0;
                let seasonNum = 1;
                
                // 匹配 "第X集" 格式
                const epMatch = episodeName.match(/第(\d+)集/);
                if (epMatch) {
                    episodeNum = parseInt(epMatch[1]);
                }
                
                // 匹配 "EPXX" 格式
                const epMatch2 = episodeName.match(/[Ee][Pp](\d+)/);
                if (epMatch2) {
                    episodeNum = parseInt(epMatch2[1]);
                }
                
                // 匹配 "S01E02" 格式
                const seMatch = episodeName.match(/[Ss](\d+)[Ee](\d+)/);
                if (seMatch) {
                    seasonNum = parseInt(seMatch[1]);
                    episodeNum = parseInt(seMatch[2]);
                }
                
                episodes.push({
                    name: episodeName,
                    season: seasonNum,
                    episode: episodeNum,
                    playId: JSON.stringify({
                        slug: res.slug,
                        points: points,
                        type: "tv",
                        tmdbId: tmdbId,
                        title: episodeName,
                        season: seasonNum,
                        episode: episodeNum
                    })
                });
            }
            
            // 按季和集排序
            episodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });
            
            // 按季分组
            const seasonMap = new Map();
            for (const ep of episodes) {
                if (!seasonMap.has(ep.season)) {
                    seasonMap.set(ep.season, []);
                }
                seasonMap.get(ep.season).push(ep);
            }
            
            // 构建播放源（每季一个播放源）
            for (const [season, seasonEpisodes] of seasonMap) {
                const points = seasonEpisodes[0]?.points || 0;
                const isFree = points === 0;
                
                playSources.push({
                    name: isFree ? `🎁 第${season}季` : `💎 第${season}季 (${points}积分)`,
                    episodes: seasonEpisodes.map(ep => ({
                        name: ep.name,
                        playId: ep.playId
                    }))
                });
            }
            
            // 如果没有季信息，将所有资源放在一个播放源中
            if (playSources.length === 0 && episodes.length > 0) {
                const points = episodes[0]?.points || 0;
                const isFree = points === 0;
                playSources.push({
                    name: isFree ? "🎁 资源列表" : `💎 资源列表 (${points}积分)`,
                    episodes: episodes.map(ep => ({
                        name: ep.name,
                        playId: ep.playId
                    }))
                });
            }
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
                vod_pic: vodPic,
                vod_content: vodContent,
                vod_year: vodYear,
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
 * 播放 - 解锁获取网盘链接，然后通过SDK解析获取播放直链
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
        let playData;
        try {
            playData = JSON.parse(playId);
        } catch (e) {
            playData = { slug: playId, points: 0, type: "free" };
        }
        
        const slug = playData.slug;
        
        if (!slug) {
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: "资源标识无效"
            };
        }
        
        console.log(`[HDHive] 解锁资源: slug=${slug}, type=${playData.type}`);
        
        // 调用解锁接口
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
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: `API 冷却中，请等待 ${waitSeconds} 秒后再试`
            };
        }
        
        // 提取网盘分享链接
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (!shareUrl) {
            console.error(`[HDHive] 未获取到分享链接`);
            return {
                urls: [],
                flag: flag,
                header: {},
                parse: 0,
                msg: "未获取到分享链接"
            };
        }
        
        console.log(`[HDHive] 分享链接: ${shareUrl}`);
        
        // 使用 OmniBox SDK 解析分享链接
        const driveInfo = await OmniBox.getDriveInfoByShareURL(shareUrl);
        console.log(`[HDHive] 网盘类型: ${driveInfo.driveType}`);
        
        // 获取文件列表
        const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
        
        if (!fileList || !fileList.files || fileList.files.length === 0) {
            return {
                urls: [],
                flag: shareUrl,
                header: {},
                parse: 0,
                msg: "网盘中没有文件"
            };
        }
        
        // 查找视频文件
        let videoFile = null;
        
        async function findVideoFile(files) {
            for (const file of files) {
                const fileName = (file.file_name || "").toLowerCase();
                const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || 
                                fileName.endsWith(".avi") || fileName.endsWith(".mov") ||
                                fileName.endsWith(".m3u8") || fileName.endsWith(".ts") ||
                                fileName.endsWith(".webm") || fileName.endsWith(".flv");
                
                if (isVideo) {
                    return file;
                }
                
                if (file.dir) {
                    try {
                        const subFiles = await OmniBox.getDriveFileList(shareUrl, file.fid);
                        if (subFiles && subFiles.files) {
                            const found = await findVideoFile(subFiles.files);
                            if (found) return found;
                        }
                    } catch (e) {
                        console.log(`获取子目录失败: ${e.message}`);
                    }
                }
            }
            return null;
        }
        
        videoFile = await findVideoFile(fileList.files);
        
        if (!videoFile) {
            console.log(`[HDHive] 未找到视频文件`);
            return {
                urls: [],
                flag: shareUrl,
                header: {},
                parse: 0,
                msg: "未找到视频文件"
            };
        }
        
        const fileId = videoFile.fid || videoFile.file_id;
        console.log(`[HDHive] 播放文件: ${videoFile.file_name}, fileId: ${fileId}`);
        
        // 获取播放信息
        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, fileId);
        
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            return {
                urls: [],
                flag: shareUrl,
                header: {},
                parse: 0,
                msg: "获取播放地址失败"
            };
        }
        
        console.log(`[HDHive] 获取到 ${playInfo.url.length} 个播放地址`);
        
        // 添加播放历史记录
        try {
            await OmniBox.addPlayHistory({
                vodId: playData.tmdbId || "",
                title: playData.title || "",
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
