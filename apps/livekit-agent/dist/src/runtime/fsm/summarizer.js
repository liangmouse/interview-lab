var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { llm } from "@livekit/agents";
import { createGeminiLLM } from "../../config/providers";
const summarizerLLM = createGeminiLLM();
export async function summarizeStage(stage, messages) {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    if (messages.length === 0)
        return "";
    const transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const prompt = `
You are an expert interview recorder.
Please summarize the following interaction from the "${stage}" stage of a technical interview.
Focus on:
1. Topics covered.
2. Candidate's key answers and demonstrated skills.
3. Any red flags or strong signals.

Keep the summary concise (under 200 words).
Transcript:
${transcript}
`;
    try {
        // OpenAI LLM 实现特定
        // 我们为总结任务创建一个临时的聊天上下文
        const chatCtx = new llm.ChatContext();
        chatCtx.addMessage({
            role: "system",
            content: prompt,
        });
        const stream = await summarizerLLM.chat({
            chatCtx: chatCtx,
        });
        let summary = "";
        try {
            for (var _g = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = await stream_1.next(), _a = stream_1_1.done, !_a; _g = true) {
                _c = stream_1_1.value;
                _g = false;
                const chunk = _c;
                const c = chunk;
                const delta = ((_f = (_e = (_d = c.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.delta) === null || _f === void 0 ? void 0 : _f.content) || c.content || "";
                summary += delta;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_g && !_a && (_b = stream_1.return)) await _b.call(stream_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        console.log(`[总结模块] 生成阶段 ${stage} 的总结:`, summary.substring(0, 50) + "...");
        return summary.trim();
    }
    catch (error) {
        console.error(`[总结模块] 阶段 ${stage} 总结失败:`, error);
        return "总结生成失败。";
    }
}
