// @name HDHive播放测试
// @push 1
// @author test
// @description 测试HDHive播放接口
// @version 1.0.0

const axios = require("axios");

const BASE_URL = "https://wd23-hdhive.hf.space";  // 你的实际地址

/**
 * 播放 - 测试解锁接口
 */
async function play(params, context) {
    const playId = params.playId || "";
    
    console.log(`[HDHive] 收到播放请求 playId: ${playId}`);
    
    if (!playId || playId === "none") {
        return { urls: [], flag: "", header: {}, parse: 0, msg: "无效的 playId" };
    }
    
    try {
        // 解析 playId
        let slug;
        try {
            const parsed = JSON.parse(playId);
            slug = parsed.slug;
        } catch (e) {
            slug = playId;
        }
        
        console.log(`[HDHive] 解析出 slug: ${slug}`);
        
        // 直接调用解锁接口（测试用）
        const response = await axios.post(`${BASE_URL}/api/cache/unlock`, {
            slug: slug,
            allow_points: true
        }, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "OmniBox/1.0"
            },
            timeout: 30000
        });
        
        console.log(`[HDHive] 解锁响应状态: ${response.status}`);
        console.log(`[HDHive] 解锁响应数据:`, JSON.stringify(response.data).substring(0, 500));
        
        const data = response.data;
        
        // 检查是否冷却
        if (data.code === "OPENAPI_COOLDOWN") {
            return {
                urls: [],
                flag: "",
                header: {},
                parse: 0,
                msg: `API冷却中，请稍后重试`
            };
        }
        
        // 提取真实链接
        const link = data.link || data.data?.full_url || data.data?.url || data.url;
        
        if (link) {
            console.log(`[HDHive] 获取到播放链接: ${link}`);
            return {
                urls: [{ name: "播放", url: link }],
                flag: "",
                header: {},
                parse: 0
            };
        } else {
            console.log(`[HDHive] 未获取到链接，响应数据:`, data);
            return {
                urls: [],
                flag: "",
                header: {},
                parse: 0,
                msg: "解锁成功但未返回链接"
            };
        }
        
    } catch (error) {
        console.error(`[HDHive] 播放错误:`, error.message);
        if (error.response) {
            console.error(`[HDHive] 状态码: ${error.response.status}`);
            console.error(`[HDHive] 响应数据:`, error.response.data);
        }
        return {
            urls: [],
            flag: "",
            header: {},
            parse: 0,
            msg: error.message
        };
    }
}

// 只需要 play 方法即可测试
module.exports = { play };

const runner = require("spider_runner");
runner.run(module.exports);
