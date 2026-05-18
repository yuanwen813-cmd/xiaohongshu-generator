/**
 * 应用入口 — DOM 事件绑定与模块编排
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化游客本地状态
  initGuest();

  // 尝试加载登录用户
  const user = await initUser();
  const isVip = user.isVip;
  const isLoggedIn = user.loggedIn;

  // ====== DOM 引用 ======
  const adTop = document.getElementById('ad-top');
  const adBottom = document.getElementById('ad-bottom');
  const inputKeyword = document.getElementById('input-keyword');
  const btnGenerate = document.getElementById('btn-generate');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const resultSection = document.getElementById('result-section');
  const resultTitle = document.getElementById('result-title');
  const resultBody = document.getElementById('result-body');
  const resultTags = document.getElementById('result-tags');
  const statusArea = document.getElementById('status-area');
  const toast = document.getElementById('toast');

  // ====== 广告位 ======
  renderAds(adTop, adBottom);
  if (isVip) hideAds();

  // ====== 状态栏渲染 ======
  renderStatusBar();

  function renderStatusBar() {
    if (!isLoggedIn) {
      // 游客模式
      const rem = Math.max(0, 3 - _guestDailyCount);
      statusArea.innerHTML = `
        <div class="status-left">
          <span class="guest-badge">游客</span>
          <span class="count-text">今日剩余 <span class="count-num">${rem}</span>/3 次</span>
        </div>
        <div>
          <button class="btn-upgrade" id="btn-login-link">登录</button>
          <button class="btn-login" id="btn-register-link">注册</button>
        </div>
      `;
      document.getElementById('btn-login-link').addEventListener('click', () => {
        location.href = 'login.html';
      });
      document.getElementById('btn-register-link').addEventListener('click', () => {
        location.href = 'login.html';
      });
      return;
    }

    if (isVip) {
      statusArea.innerHTML = `
        <div class="status-left">
          <span class="vip-badge">VIP</span>
          <span style="font-size:0.8rem;color:var(--text-secondary)">无限次数 · 高级模板 · 无广告</span>
        </div>
        <div>
          <a href="dashboard.html" style="font-size:0.75rem;color:var(--text-muted);text-decoration:none;margin-right:12px">用户中心</a>
          <button class="btn-logout" id="btn-logout">退出</button>
        </div>
      `;
      document.getElementById('btn-logout').addEventListener('click', async () => {
        await logout();
        location.reload();
      });
    } else {
      const rem = remainingCount();
      statusArea.innerHTML = `
        <div class="status-left">
          <span class="guest-badge">已登录</span>
          <span class="count-text">今日剩余 <span class="count-num">${rem === Infinity ? '∞' : rem}</span>/3 次</span>
        </div>
        <div>
          <button class="btn-upgrade" id="btn-upgrade">升级会员</button>
          <button class="btn-logout" id="btn-logout">退出</button>
        </div>
      `;
      document.getElementById('btn-upgrade').addEventListener('click', () => {
        location.href = 'vip.html';
      });
      document.getElementById('btn-logout').addEventListener('click', async () => {
        await logout();
        location.reload();
      });
    }
  }

  // ====== 风格选择按钮 ======
  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ====== 输入框字数统计 ======
  inputKeyword.addEventListener('input', () => {
    const len = inputKeyword.value.length;
    document.getElementById('char-count-num').textContent = len;
  });

  // ====== 生成按钮 ======
  btnGenerate.addEventListener('click', async () => {
    const keyword = inputKeyword.value.trim();
    if (!keyword) {
      showToast('请输入关键词再生成');
      shake(inputKeyword);
      return;
    }

    // 检查生成次数
    if (isLoggedIn) {
      if (!canGenerate()) {
        showToast('今日次数已用完，请升级会员');
        return;
      }
    } else {
      if (!canGuestGenerate()) {
        showToast('今日次数已用完，请登录或升级会员');
        return;
      }
    }

    // 获取风格选择
    const styleEl = document.querySelector('.style-btn.active');
    const style = styleEl ? styleEl.dataset.style : '';

    // 进入加载状态
    setLoading(true);

    let result;
    if (isVip) {
      // VIP 用户：调用 AI
      try {
        result = await aiGenerate(keyword, style);
      } catch (err) {
        console.warn('AI generate failed, fallback to template:', err.message);
        const delay = 300 + Math.random() * 400;
        await new Promise(r => setTimeout(r, delay));
        result = generate(keyword, 'premium');
        showToast('AI 繁忙，已为你使用备用模板生成');
      }
    } else {
      // 普通用户：模板生成
      const delay = 400 + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
      result = generate(keyword, 'basic');
    }

    // 渲染结果
    resultSection.classList.add('visible');
    resultTitle.textContent = result.title;
    resultBody.textContent = result.body;
    resultTags.innerHTML = result.tags
      .map(tag => `<span class="result-tag">#${tag}</span>`)
      .join('');

    // 消耗次数
    if (isLoggedIn) {
      await useOne();
    } else {
      guestUseOne();
    }
    renderStatusBar();

    // 退出加载状态
    setLoading(false);

    // 滚动到结果区
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ====== 复制按钮 ======
  document.getElementById('btn-copy-title').addEventListener('click', () => {
    copyText(resultTitle.textContent, 'btn-copy-title');
  });
  document.getElementById('btn-copy-body').addEventListener('click', () => {
    copyText(resultBody.textContent, 'btn-copy-body');
  });
  document.getElementById('btn-copy-all').addEventListener('click', () => {
    const tags = [...resultTags.querySelectorAll('.result-tag')]
      .map(el => el.textContent)
      .join(' ');
    const all = `${resultTitle.textContent}\n\n${resultBody.textContent}\n\n${tags}`;
    copyText(all, 'btn-copy-all');
  });

  // ====== 回车快捷键 ======
  inputKeyword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnGenerate.click();
  });
});

// ====== 工具函数 ======

function setLoading(loading) {
  const btn = document.getElementById('btn-generate');
  const text = document.getElementById('btn-text');
  const spinner = document.getElementById('btn-spinner');
  btn.disabled = loading;
  text.textContent = loading ? '生成中...' : '🔥 生成文案';
  spinner.style.display = loading ? 'inline-block' : 'none';
}

function copyText(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.classList.add('copied');
    btn.textContent = '✓ 已复制';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = originalText;
    }, 2000);
    showToast('已复制到剪贴板', true);
  }).catch(() => {
    showToast('复制失败，请手动复制');
  });
}

function showToast(message, success = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (success ? ' success' : '');
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function shake(el) {
  el.style.transition = 'transform 0.1s';
  el.style.transform = 'translateX(-4px)';
  setTimeout(() => { el.style.transform = 'translateX(4px)'; }, 100);
  setTimeout(() => { el.style.transform = 'translateX(-2px)'; }, 200);
  setTimeout(() => { el.style.transform = 'translateX(0)'; }, 300);
}
