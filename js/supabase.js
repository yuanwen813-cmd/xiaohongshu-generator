/**
 * Supabase 客户端初始化
 * 替换 YOUR_SUPABASE_URL 和 YOUR_SUPABASE_ANON_KEY 为真实值
 */

const SUPABASE_URL = 'https://kecxbbpdxxzbhzvlkzbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlY3hiYnBkeHh6Ymh6dmxremJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjUyMDgsImV4cCI6MjA5NDQwMTIwOH0.G2E19lWZAvu7WzizzBHEzt5-SlqPNrmNzOjrLKrxGSo';

var _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
