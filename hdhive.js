// @name 测试源
// @push 1
async function home(params, context) {
    return {
        class: [{ type_id: "test", type_name: "测试分类", type_pid: "0" }],
        list: [{ vod_id: "test_1", vod_name: "测试影片", vod_pic: "", vod_remarks: "2025" }],
        filters: {}
    };
}
async function category(params, context) {
    return { page: 1, pagecount: 1, total: 1, list: [{ vod_id: "test_1", vod_name: "测试影片", vod_pic: "", vod_remarks: "" }] };
}
async function detail(params, context) { return { list: [] }; }
async function search(params, context) { return { list: [] }; }
async function play(params, context) { return { urls: [], msg: "测试" }; }
module.exports = { home, category, detail, search, play };
const runner = require("spider_runner");
runner.run(module.exports);
