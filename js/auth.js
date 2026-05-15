/**
 * 用户状态模块
 * 当前用 localStorage 模拟，后续替换为真实后端 API 只需修改此文件
 *
 * 数据结构: { loggedIn: boolean, isVip: boolean, dailyCount: number, lastDate: string }
 */

const STORAGE_KEY = 'xhsauth';

function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { loggedIn: false, isVip: false, dailyCount: 0, lastDate: '' };
    return JSON.parse(raw);
  } catch {
    return { loggedIn: false, isVip: false, dailyCount: 0, lastDate: '' };
  }
}

function saveUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/** 重置每日次数（跨天自动调用） */
function resetDailyIfNeeded() {
  const user = getUser();
  const today = new Date().toDateString();
  if (user.lastDate !== today) {
    user.dailyCount = 0;
    user.lastDate = today;
    saveUser(user);
  }
}

/** 自动创建游客身份，返回当前用户状态 */
function initUser() {
  resetDailyIfNeeded();
  let user = getUser();
  if (!user.loggedIn) {
    user = { loggedIn: true, isVip: false, dailyCount: 0, lastDate: new Date().toDateString() };
    saveUser(user);
  }
  return user;
}

/** 会员登录 */
function loginAsVip() {
  const user = getUser();
  user.loggedIn = true;
  user.isVip = true;
  saveUser(user);
  return user;
}

/** 退出登录（回到游客模式） */
function logout() {
  const today = new Date().toDateString();
  saveUser({ loggedIn: true, isVip: false, dailyCount: 0, lastDate: today });
}

/** 今日剩余生成次数，会员返回 Infinity */
function remainingCount() {
  const user = getUser();
  if (user.isVip) return Infinity;
  return Math.max(0, 3 - user.dailyCount);
}

/** 是否还能生成 */
function canGenerate() {
  const user = getUser();
  if (user.isVip) return true;
  return user.dailyCount < 3;
}

/** 消耗一次生成次数（游客调用） */
function useOne() {
  const user = getUser();
  if (user.isVip) return;
  user.dailyCount += 1;
  saveUser(user);
}

// ====== 预留：未来替换为真实后端 API 的接口签名 ======
// async function fetchUserFromServer() { ... }
// async function syncCountToServer() { ... }
// async function verifyMembership() { ... }
