/**
 * 广告位管理模块
 * 会员自动隐藏广告位
 * 预留 replaceWithRealAd() 接口，后续拿到广告代码直接替换
 */

/** 顶部广告位占位内容 */
const AD_TOP_HTML = `
  <div class="ad-slot ad-slot--top" id="ad-top">
    <div class="ad-placeholder">
      <span class="ad-label">广告</span>
      <p>广告位招租</p>
      <small>联系微信：your_wechat</small>
    </div>
  </div>
`;

/** 底部广告位占位内容 */
const AD_BOTTOM_HTML = `
  <div class="ad-slot ad-slot--bottom" id="ad-bottom">
    <div class="ad-placeholder">
      <span class="ad-label">广告</span>
      <p>广告位招租</p>
      <small>联系微信：your_wechat</small>
    </div>
  </div>
`;

/** 渲染广告位到指定容器 */
function renderAds(topContainer, bottomContainer) {
  if (topContainer) topContainer.innerHTML = AD_TOP_HTML;
  if (bottomContainer) bottomContainer.innerHTML = AD_BOTTOM_HTML;
}

/** 会员调用：隐藏所有广告 */
function hideAds() {
  document.querySelectorAll('.ad-slot').forEach(el => el.classList.add('ad-hidden'));
}

// ====== 预留：替换为真实广告代码 ======
/**
 * replaceWithRealAd(adCode, position)
 * @param {string} adCode - 广告平台提供的 HTML/JS 代码
 * @param {'top'|'bottom'} position - 广告位置
 *
 * 后续示例：
 * replaceWithRealAd('<script>...(Google AdSense code)...</script>', 'top');
 */
function replaceWithRealAd(adCode, position) {
  const selector = position === 'top' ? '#ad-top' : '#ad-bottom';
  const el = document.querySelector(selector);
  if (el) el.innerHTML = adCode;
}
