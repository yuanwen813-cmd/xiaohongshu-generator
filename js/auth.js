/**
 * 用户认证模块 — 基于 Supabase Auth + profiles 表
 *
 * profiles 行在用户注册时由数据库触发器自动创建
 * 对外暴露的函数签名保持与旧版 localStorage 版本兼容
 */

// ====== 缓存当前用户 profile，避免重复请求 ======
let _cachedProfile = null;

/** 获取当前登录用户 */
async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 从 profiles 表加载当前用户数据 */
async function loadProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;
  _cachedProfile = data;
  return data;
}

/** 注册新用户（同时自动登录） */
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** 登录已有用户 */
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _cachedProfile = null;
  return data;
}

/** 退出登录 */
async function logout() {
  _cachedProfile = null;
  await supabase.auth.signOut();
}

// ====== 兼容旧版接口 ======

/** 初始化用户 — 页面加载时调用，返回用户状态 */
async function initUser() {
  const session = await getSession();
  if (!session) {
    return { loggedIn: false, isVip: false, dailyCount: 0, lastDate: '' };
  }

  const profile = await loadProfile();
  if (!profile) {
    return { loggedIn: false, isVip: false, dailyCount: 0, lastDate: '' };
  }

  // 跨天重置次数
  await resetDailyIfNeeded(profile);

  return {
    loggedIn: true,
    isVip: profile.is_vip,
    dailyCount: profile.daily_count,
    lastDate: profile.last_date,
  };
}

/** 获取缓存的用户信息 */
function getUser() {
  return _cachedProfile
    ? {
        loggedIn: true,
        isVip: _cachedProfile.is_vip,
        dailyCount: _cachedProfile.daily_count,
        lastDate: _cachedProfile.last_date,
      }
    : { loggedIn: false, isVip: false, dailyCount: 0, lastDate: '' };
}

/** 每天重置计数（跨天自动调用） */
async function resetDailyIfNeeded(profile) {
  const today = new Date().toDateString();
  if (profile && profile.last_date !== today) {
    const { error } = await supabase
      .from('profiles')
      .update({ daily_count: 0, last_date: today })
      .eq('id', profile.id);
    if (!error) {
      profile.daily_count = 0;
      profile.last_date = today;
      _cachedProfile = profile;
    }
  }
}

/** 今日剩余生成次数 */
function remainingCount() {
  if (!_cachedProfile) return 3;
  if (_cachedProfile.is_vip) return Infinity;
  return Math.max(0, 3 - _cachedProfile.daily_count);
}

/** 是否还能生成 */
function canGenerate() {
  if (!_cachedProfile) {
    // 未登录用户也允许生成（游客模式）
    return (_guestDailyCount || 0) < 3;
  }
  if (_cachedProfile.is_vip) return true;
  return _cachedProfile.daily_count < 3;
}

/** 消耗一次生成次数 */
async function useOne() {
  if (!_cachedProfile || _cachedProfile.is_vip) return;
  const newCount = _cachedProfile.daily_count + 1;
  const { error } = await supabase
    .from('profiles')
    .update({ daily_count: newCount })
    .eq('id', _cachedProfile.id);
  if (!error) {
    _cachedProfile.daily_count = newCount;
  }
}

// ====== 游客模式（未登录用户的本地计数） ======
let _guestDailyCount = 0;
const GUEST_KEY = 'xhs_guest';

function getGuestState() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return { count: 0, date: '' };
    const state = JSON.parse(raw);
    const today = new Date().toDateString();
    if (state.date !== today) return { count: 0, date: today };
    return state;
  } catch {
    return { count: 0, date: '' };
  }
}

function saveGuestState(state) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(state));
}

function initGuest() {
  const state = getGuestState();
  _guestDailyCount = state.count;
}

function canGuestGenerate() {
  return _guestDailyCount < 3;
}

function guestUseOne() {
  const state = getGuestState();
  state.count += 1;
  _guestDailyCount = state.count;
  saveGuestState(state);
}
