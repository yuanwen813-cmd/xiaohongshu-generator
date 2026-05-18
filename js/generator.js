/**
 * 文案生成引擎
 * 普通用户：模板随机拼装
 * VIP 用户：调用 /api/generate（DeepSeek AI）
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
 * 模板生成（普通用户 / AI fallback 用）
 */
function generate(keyword, level) {
  const title = fillTemplate(pick(TITLE_TEMPLATES[level]), keyword);
  const body = fillTemplate(pick(BODY_TEMPLATES[level]), keyword);
  const tags = pickN(TAG_POOL[level], level === 'basic' ? 4 : 6);
  return { title, body, tags };
}

/**
 * AI 生成（VIP 用户）
 * @param {string} keyword
 * @param {string} [style] - 可选风格，不传则随机
 * @returns {Promise<{ title: string, body: string, tags: string[] }>}
 */
async function aiGenerate(keyword, style) {
  const session = await _db.auth.getSession();
  const token = session?.data?.session?.access_token;
  if (!token) throw new Error('登录已过期');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ keyword, style: style || '' }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI 生成失败 (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('AI 响应超时，请重试');
    throw err;
  }
}
