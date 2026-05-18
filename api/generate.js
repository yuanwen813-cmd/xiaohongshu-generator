/**
 * /api/generate — DeepSeek AI 文案生成代理
 *
 * 需要 Vercel 环境变量:
 *   DEEPSEEK_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// 频率限制：内存计数器（冷重启会清空，小规模够用）
const rateLimit = new Map();
const RATE_LIMIT_MAX = 5;      // 每分钟最多 5 次
const RATE_LIMIT_WINDOW = 60000;

const SYSTEM_PROMPT = `你是小红书顶级爆款文案专家，深谙平台流量密码和用户心理。
你的文案特点：
- 口语化、真诚，像闺蜜在聊天，不用书面语
- 善用 emoji 和短句断行，每 1-2 句换行，有呼吸感
- 标题要抓眼球，用数字、悬念、情绪、对比制造点击冲动
- 正文要制造信任感：痛点共鸣 → 解决方案 → 使用感受 → 效果对比
- 不要假大空，要用具体细节和真实场景打动人
- 标签精准匹配目标人群搜索习惯，5个左右

10 种风格（根据用户选择或随机匹配）：
1. 🔥 种草安利：以亲身经历安利，语气兴奋真诚，"姐妹们冲！"
2. 📊 测评对比：用数据和对比说话，A vs B 详细横评
3. 🚫 避坑指南：先列举踩过的坑，再给正确答案
4. 📖 教程攻略：保姆级干货，步骤清晰可操作，学了就会
5. 💕 情感共鸣：从情绪切入，引发强烈共情，"看哭了..."
6. 💡 干货分享：纯知识输出，信息密度大，收藏率极高
7. 🎬 好物开箱：刚拿到手的惊喜感，第一人称实拍体验
8. 📝 合集盘点："10 个必入的..." "年度最爱 TOP 5"
9. 🏃 真实体验：用了一段时间后的老用户反馈，可信度高
10. 🎯 痛点解决：直击用户焦虑，提供立竿见影的方案

输出必须是纯 JSON，不要额外解释文字，不要 markdown 代码块标记：
{"title":"标题","body":"正文（用 \\\\n 换行分段）","tags":["标签1","标签2","标签3","标签4","标签5"]}`;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://xiaohongshu-generator.online');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    const { keyword, style } = req.body || {};
    const token = (req.headers.authorization || '').replace('Bearer ', '');

    // 1. 输入校验
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({ error: '请输入关键词' });
    }
    if (keyword.length > 50) {
      return res.status(400).json({ error: '关键词最长 50 字' });
    }
    if (!token) {
      return res.status(401).json({ error: '请先登录' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. 验证用户身份
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    // 3. 检查 VIP
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_vip')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_vip) {
      return res.status(403).json({ error: '仅限 VIP 会员使用 AI 生成' });
    }

    // 4. 频率限制
    const now = Date.now();
    const timestamps = (rateLimit.get(user.id) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: '请求太频繁，请 1 分钟后再试' });
    }
    timestamps.push(now);
    rateLimit.set(user.id, timestamps);

    // 5. 调用 DeepSeek
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.9,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `请为"${keyword.trim()}"生成一篇小红书爆款文案。${style && style !== '随机风格' ? `严格使用"${style}"风格来写。` : '请随机选择一种贴合产品/主题调性的风格。'}`,
          },
        ],
      }),
    });

    if (!deepseekRes.ok) {
      console.error('DeepSeek error:', deepseekRes.status, await deepseekRes.text());
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    const data = await deepseekRes.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 6. 解析 AI 返回的 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('DeepSeek non-JSON response:', content);
      return res.status(500).json({ error: 'AI 返回格式异常，请重试' });
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.title || !result.body || !result.tags) {
      return res.status(500).json({ error: 'AI 返回内容不完整，请重试' });
    }

    return res.status(200).json({
      title: result.title,
      body: result.body,
      tags: result.tags.slice(0, 6),
    });

  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ error: '生成失败，请稍后重试' });
  }
};
