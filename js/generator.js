/**
 * 文案生成引擎
 * 当前用模板随机拼装实现，后续接入 AI 时替换 generate() 内部逻辑即可
 */

/** 从数组中随机取一项 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 从数组中随机取 N 项不重复 */
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** 将关键词嵌入模板 */
function fillTemplate(template, keyword) {
  return template.replace(/\{keyword\}/g, keyword);
}

/**
 * 生成文案
 * @param {string} keyword - 用户输入的关键词
 * @param {'basic'|'premium'} level - 模板等级
 * @returns {{ title: string, body: string, tags: string[] }}
 */
function generate(keyword, level) {
  const title = fillTemplate(pick(TITLE_TEMPLATES[level]), keyword);
  const body = fillTemplate(pick(BODY_TEMPLATES[level]), keyword);
  const tags = pickN(TAG_POOL[level], level === 'basic' ? 4 : 6);
  return { title, body, tags };
}

// ====== 预留：未来接入 AI 的接口 ======
/**
 * aiGenerate(keyword)
 * 后续接入 Claude API / OpenAI 等，返回 { title, body, tags }
 *
 * async function aiGenerate(keyword) {
 *   const response = await fetch('/api/generate', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ keyword })
 *   });
 *   return response.json();
 * }
 */
async function aiGenerate(keyword) {
  // TODO: 接入 AI API
  throw new Error('AI 接口尚未接入');
}
