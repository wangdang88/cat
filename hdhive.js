/**
 * 详情 - 每个115资源作为一个播放源，免费资源展示其所有视频文件作为剧集
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
        // 筛选115资源
        const resources = allResources.filter(r => is115Resource(r));
        console.log(`[HDHive] 详情: ${mediaType}/${tmdbId}, 共${allResources.length}个资源，115资源${resources.length}个`);

        // 无115资源时直接返回
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
        // 取第一个资源的标题作为影片名称
        const vodName = resources[0].title || resources[0].name || `${mediaType === "movie" ? "电影" : "电视剧"} ${tmdbId}`;

        // 遍历每个115资源
        for (const r of resources) {
            const points = r.unlock_points || 0;
            const isFree = points === 0 || r.is_free_for_user === true;
            const sourceName = `${isFree ? "🎁 115免费" : `💎 115付费 (${points}积分)`} - ${r.title || r.name || "未命名"}`;
            let episodes = [];

            if (isFree) {
                // 免费资源：尝试获取文件列表
                try {
                    // 先解锁获取分享链接（注意：解锁免费资源不消耗积分）
                    const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: r.slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 15000 });
                    const unlockData = unlockResp.data;
                    const shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
                    if (shareUrl) {
                        // 获取文件列表
                        const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
                        if (fileList && fileList.files && fileList.files.length > 0) {
                            // 递归收集所有视频文件
                            const videoFiles = [];
                            async function collectVideoFiles(files) {
                                for (const file of files) {
                                    const fileName = (file.file_name || "").toLowerCase();
                                    const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || fileName.endsWith(".avi") || fileName.endsWith(".mov") || fileName.endsWith(".m3u8") || fileName.endsWith(".ts");
                                    if (isVideo) {
                                        videoFiles.push(file);
                                    }
                                    if (file.dir) {
                                        try {
                                            const subFiles = await OmniBox.getDriveFileList(shareUrl, file.fid);
                                            if (subFiles && subFiles.files) await collectVideoFiles(subFiles.files);
                                        } catch (e) {}
                                    }
                                }
                            }
                            await collectVideoFiles(fileList.files);
                            // 按文件名排序
                            videoFiles.sort((a, b) => (a.file_name || "").localeCompare(b.file_name || ""));
                            episodes = videoFiles.map((file, idx) => ({
                                name: file.file_name || `视频${idx+1}`,
                                playId: JSON.stringify({
                                    slug: r.slug,
                                    points: 0,
                                    type: mediaType,
                                    tmdbId: tmdbId,
                                    fileId: file.fid || file.file_id,
                                    fileName: file.file_name
                                })
                            }));
                        }
                    }
                } catch (e) {
                    console.error(`获取资源 ${r.slug} 剧集列表失败:`, e.message);
                }
                // 如果获取失败，添加一个占位剧集，提示用户可以尝试播放
                if (episodes.length === 0) {
                    episodes = [{
                        name: "获取剧集列表失败，点击尝试播放",
                        playId: JSON.stringify({ slug: r.slug, points: 0, type: mediaType, tmdbId: tmdbId })
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
        // 出错时返回空列表，避免影响前端显示
        return { list: [] };
    }
}

/**
 * 播放 - 支持直接播放指定的文件ID或自动匹配第一个视频
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

        // 解锁获取分享链接
        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        const data = resp.data;
        if (data.code === "OPENAPI_COOLDOWN") {
            const waitSeconds = data.retry_after_seconds || 60;
            return { urls: [], flag: flag, header: {}, parse: 0, msg: `API冷却中，请等待${waitSeconds}秒` };
        }
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        if (!shareUrl) return { urls: [], flag: flag, header: {}, parse: 0, msg: "未获取到分享链接" };
        console.log(`[HDHive] 分享链接: ${shareUrl}`);

        let fileId = playData.fileId;
        if (!fileId) {
            // 没有指定文件ID，获取文件列表并取第一个视频文件
            const fileList = await OmniBox.getDriveFileList(shareUrl, "0");
            if (!fileList || !fileList.files || fileList.files.length === 0) {
                return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "网盘中没有文件" };
            }
            // 递归查找第一个视频文件
            async function findFirstVideoFile(files) {
                for (const file of files) {
                    const fileName = (file.file_name || "").toLowerCase();
                    const isVideo = fileName.endsWith(".mp4") || fileName.endsWith(".mkv") || fileName.endsWith(".avi") || fileName.endsWith(".mov") || fileName.endsWith(".m3u8") || fileName.endsWith(".ts");
                    if (isVideo) return file;
                    if (file.dir) {
                        try {
                            const subFiles = await OmniBox.getDriveFileList(shareUrl, file.fid);
                            if (subFiles && subFiles.files) {
                                const found = await findFirstVideoFile(subFiles.files);
                                if (found) return found;
                            }
                        } catch (e) {}
                    }
                }
                return null;
            }
            const videoFile = await findFirstVideoFile(fileList.files);
            if (!videoFile) return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "未找到视频文件" };
            fileId = videoFile.fid || videoFile.file_id;
            console.log(`[HDHive] 自动匹配视频文件: ${videoFile.file_name}`);
        }

        const playInfo = await OmniBox.getDriveVideoPlayInfo(shareUrl, fileId);
        if (!playInfo || !playInfo.url || playInfo.url.length === 0) {
            return { urls: [], flag: shareUrl, header: {}, parse: 0, msg: "获取播放地址失败" };
        }

        // 记录播放历史（可选）
        try {
            await OmniBox.addPlayHistory({
                vodId: playData.tmdbId || "",
                episode: playData.fileName || (playData.episode ? `第${playData.episode}集` : slug)
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
