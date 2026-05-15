/**
 * 详情 - 每个115资源作为一个播放源，免费资源显示其内部所有视频文件作为剧集
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
            // 电影：每个资源作为一个播放源，单个剧集
            for (const r of resources) {
                const points = r.unlock_points || 0;
                const isFree = points === 0 || r.is_free_for_user === true;
                const sourceName = isFree ? `🎁 115免费` : `💎 115付费 (${points}积分)`;
                const displayName = `${sourceName} - ${r.title || r.name || '未命名'}`;
                playSources.push({
                    name: displayName,
                    episodes: [{
                        name: "播放",
                        playId: JSON.stringify({ slug: r.slug, points: points, type: "movie", tmdbId: tmdbId })
                    }]
                });
            }
        } else {
            // 电视剧：每个资源作为一个播放源
            for (const r of resources) {
                const points = r.unlock_points || 0;
                const isFree = points === 0 || r.is_free_for_user === true;
                const sourceName = isFree ? `🎁 115免费` : `💎 115付费 (${points}积分)`;
                const displayName = `${sourceName} - ${r.title || r.name || '未命名'}`;
                let episodes = [];
                if (isFree) {
                    // 免费资源可以提前解锁获取文件列表
                    try {
                        const unlockResp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: r.slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
                        const unlockData = unlockResp.data;
                        const shareUrl = unlockData.link || unlockData.data?.full_url || unlockData.data?.url || unlockData.url;
                        if (shareUrl) {
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
                                    name: file.file_name || `第${idx+1}集`,
                                    playId: JSON.stringify({
                                        slug: r.slug,
                                        points: points,
                                        type: "tv",
                                        tmdbId: tmdbId,
                                        fileId: file.fid || file.file_id,
                                        fileName: file.file_name
                                    })
                                }));
                            }
                        }
                    } catch (e) {
                        console.error(`获取资源 ${r.slug} 文件列表失败:`, e.message);
                    }
                }
                if (episodes.length === 0) {
                    // 付费资源或获取失败时，使用默认单集
                    episodes = [{
                        name: "播放",
                        playId: JSON.stringify({ slug: r.slug, points: points, type: "tv", tmdbId: tmdbId })
                    }];
                }
                playSources.push({
                    name: displayName,
                    episodes: episodes
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
 * 播放 - 支持直接播放指定的文件ID
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
        console.log(`[HDHive] 解锁115资源: slug=${slug}, 目标文件: ${playData.fileName || '自动匹配'}`);

        const resp = await axios.post(`${BASE_URL}/api/cache/unlock`, { slug: slug, allow_points: true }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
        const data = resp.data;
        if (data.code === "OPENAPI_COOLDOWN") {
            const waitSeconds = data.retry_after_seconds || 60;
            return { urls: [], flag: flag, header: {}, parse: 0, msg: `API冷却中，请等待${waitSeconds}秒` };
        }
        const shareUrl = data.link || data.data?.full_url || data.data?.url || data.url;
        if (!shareUrl) return { urls: [], flag: flag, header: {}, parse: 0, msg: "未获取到分享链接" };
        console.log(`[HDHive] 115分享链接: ${shareUrl}`);

        let fileId = playData.fileId; // 如果传递了 fileId，直接使用
        if (!fileId) {
            // 没有 fileId 时，获取文件列表并取第一个视频文件
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

        try {
            await OmniBox.addPlayHistory({
                vodId: playData.tmdbId || "",
                episode: playData.fileName || slug
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
