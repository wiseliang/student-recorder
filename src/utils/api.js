import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NativeSecureStore from "expo-secure-store";
import { Platform } from "react-native";
const preview =
  Platform?.OS === "web" && process.env.EXPO_PUBLIC_UI_PREVIEW === "1";
const SecureStore = {
  getItemAsync: async (k) =>
    preview ? sessionStorage.getItem(k) : NativeSecureStore.getItemAsync(k),
  setItemAsync: async (k, v) =>
    preview
      ? sessionStorage.setItem(k, v)
      : NativeSecureStore.setItemAsync(k, v),
};
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://wiseliang.cloud/student-recorder";
const namespace = BASE_URL.replace(/[^a-zA-Z0-9._-]/g, "_");
const key = (name) => `recorder.${namespace}.${name}`;
let schoolListener = () => {};
export function onSchoolExpired(fn) {
  schoolListener = fn;
  return () => {
    schoolListener = () => {};
  };
}
let refreshFlight = null,
  identityListener = () => {};
export class ApiError extends Error {
  constructor(message, status = 0, code = "NETWORK_ERROR", details = {}) {
    super(message);
    Object.assign(this, { status, code, ...details });
  }
}
export function onIdentityLost(fn) {
  identityListener = fn;
  return () => {
    identityListener = () => {};
  };
}
let identityEpoch = 0;
async function storedSession() {
  const bundled = await SecureStore.getItemAsync(key("session"));
  if (bundled) {
    try {
      const data = JSON.parse(bundled);
      if (typeof data.openid === "string" && typeof data.token === "string" && typeof data.refreshToken === "string") return data;
    } catch {}
  }
  const [openid, token, refreshToken, recoveryKey] = await Promise.all([
    AsyncStorage.getItem(key("openid")), SecureStore.getItemAsync(key("token")),
    SecureStore.getItemAsync(key("refresh")), SecureStore.getItemAsync(key("recovery")),
  ]);
  return {openid, token, refreshToken, recoveryKey};
}
export async function identity() {
  const {openid, token} = await storedSession();
  return {openid, token};
}
async function clearPendingRefresh() {
  await SecureStore.setItemAsync(key("refresh-operation"), "");
}
async function saveIdentity(data) {
  if (!data.openid || !data.token || !data.refreshToken)
    throw new ApiError("登录响应不完整，请稍后重试", 502, "INVALID_RESPONSE");
  const old = await storedSession();
  const backup = data.recoveryKey || (old.openid === data.openid ? old.recoveryKey : null);
  // One atomic secure-store write is authoritative. Legacy aliases are best effort.
  await SecureStore.setItemAsync(key("session"), JSON.stringify({
    openid:data.openid,token:data.token,refreshToken:data.refreshToken,recoveryKey:backup||null,
  }));
  await Promise.allSettled([
    SecureStore.setItemAsync(key("token"),data.token),
    SecureStore.setItemAsync(key("refresh"),data.refreshToken),
    SecureStore.setItemAsync(key("recovery"),backup||""),
    AsyncStorage.setItem(key("openid"),data.openid),
  ]);
  return data;
}
async function raw(
  method,
  path,
  data,
  { signal, token, timeout = 30000 } = {},
) {
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), timeout);
  const stop = () => abort.abort();
  signal?.addEventListener("abort", stop);
  if (signal?.aborted) abort.abort();
  try {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: abort.signal,
    });
    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(
        "服务暂时没有返回有效结果，请稍后重试",
        response.status || 502,
        "INVALID_RESPONSE",
        { retryable: true },
      );
    }
    if (!response.ok)
      throw new ApiError(
        result.error || "请求失败",
        response.status,
        result.code || "REQUEST_FAILED",
        {
          retryable: !!result.retryable,
          retryAfter: result.retryAfter,
          taskUuid: result.taskUuid,
        },
      );
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (signal?.aborted) throw new ApiError("操作已取消", 0, "ABORTED");
    if (e.name === "AbortError")
      throw new ApiError("请求超时，请检查网络后重试", 0, "TIMEOUT", {
        retryable: true,
      });
    throw new ApiError(
      "网络连接失败，可重试；已提交的任务会继续运行",
      0,
      "NETWORK_ERROR",
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}
export async function refreshIdentity() {
  if (!refreshFlight) {
    const epoch=identityEpoch;
    refreshFlight=(async()=>{
      const current=await storedSession(),refreshToken=current.refreshToken;
      if(!refreshToken)throw new ApiError("请使用学校账号验证，原记录仍保留",401,"SESSION_RECOVERY_REQUIRED");
      let operation;
      try {operation=JSON.parse(await SecureStore.getItemAsync(key("refresh-operation")))}catch{}
      if(!operation || operation.refreshToken!==refreshToken) {
        // This is an idempotency identifier, not an authentication credential.
        operation={refreshToken,operationId:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)+"-"+Math.random().toString(36).slice(2)};
        await SecureStore.setItemAsync(key("refresh-operation"),JSON.stringify(operation));
      }
      const response=await raw("POST","/api/auth/refresh",operation);
      if(epoch!==identityEpoch)throw new ApiError("登录账号已变化，请重新进入",409,"IDENTITY_CHANGED");
      const result=await saveIdentity(response);
      await clearPendingRefresh().catch(()=>{});
      return result;
    })().finally(()=>{refreshFlight=null});
  }
  return refreshFlight;
}
export async function initializeIdentity() {
  const current=await storedSession();
  if(current.refreshToken){
    try{return await refreshIdentity()}
    catch(e){if(e.status===0&&current.openid)return {...current,offline:true};throw e}
  }
  const oldServer=await AsyncStorage.getItem("authServer"),oldToken=await AsyncStorage.getItem("authToken"),oldId=await AsyncStorage.getItem("openid");
  if(!current.openid&&oldServer===BASE_URL&&oldToken){
    try{return await saveIdentity(await raw("POST","/api/auth/login",{platform:"android"},{token:oldToken}))}
    catch(e){if(e.status===401)throw new ApiError("请验证学校账号以找回原记录",401,"LEGACY_RECOVERY_REQUIRED");throw e}
  }
  if(current.openid||oldId&&oldServer===BASE_URL)throw new ApiError("请验证学校账号以找回原记录",401,"SESSION_RECOVERY_REQUIRED");
  throw new ApiError("使用学校账号登录，原有账号可直接找回",401,"SCHOOL_SIGNIN_REQUIRED");
}
export async function schoolSignIn(action,body={}) {
  if(!["start","status","code","captcha","resend","create","cancel"].includes(action))throw new ApiError("无效的学校登录操作",400,"INVALID_ACTION");
  const result=await raw("POST","/api/auth/school-signin/"+action,body,{timeout:30000});
  if(result.connected&&result.identity){
    identityEpoch++;
    await saveIdentity(result.identity);
    await clearPendingRefresh().catch(()=>{});
  }
  return result;
}
export function switchSchoolAccount() {
  identityEpoch++;
  identityListener(new ApiError("验证另一学校账号后切换，当前账号记录保留",401,"SCHOOL_SIGNIN_REQUIRED"));
}
export async function recoverIdentity(recoveryKey) {
  const normalized = recoveryKey.trim().toUpperCase();
  const data = await raw("POST", "/api/auth/recover", {
    recoveryKey: normalized,
  });
  identityEpoch++;
  const result=await saveIdentity({ ...data, recoveryKey: normalized });
  await clearPendingRefresh().catch(()=>{});
  return result;
}
export async function request(method, path, data, options = {}) {
  let current = await identity();
  try {
    return await raw(method, path, data, {
      ...options,
      token: current.token,
      timeout: (path.includes("/api/auth/") || path.endsWith("/managed/refresh")) ? 90000 : 30000,
    });
  } catch (error) {
    if (
      error.status === 401 &&
      ["SCHOOL_AUTH_REQUIRED", "SCHOOL_LOGIN_FAILED"].includes(error.code)
    )
      schoolListener(error);
    if (error.status === 401 && error.code === "AUTH_REQUIRED") {
      try {
        const latest = await identity();
        if (latest.token === current.token) await refreshIdentity();
        current = await identity();
        return await raw(method, path, data, {
          ...options,
          token: current.token,
        });
      } catch (e) {
        if (
          e.status === 401 &&
          ["SCHOOL_AUTH_REQUIRED", "SCHOOL_LOGIN_FAILED"].includes(e.code)
        )
          schoolListener(e);
        else if (e.status === 401) identityListener(e);
        throw e;
      }
    }
    throw error;
  }
}
export const get = (path, params, options) =>
  request(
    "GET",
    path + (params ? "?" + new URLSearchParams(params).toString() : ""),
    undefined,
    options,
  );
export const post = (path, data = {}, options) =>
  request("POST", path, data, options);
export const del = (path) => request("DELETE", path);
export const getRecoveryKey = async () => (await storedSession()).recoveryKey || null;
export async function rotateRecoveryKey() {
  const data = await post("/api/auth/recovery-key");
  const current=await storedSession();
  await saveIdentity({...current,recoveryKey:data.recoveryKey});
  return data.recoveryKey;
}
export async function cacheRead(name) {
  const { openid } = await identity();
  try {
    return JSON.parse(
      await AsyncStorage.getItem(key("cache." + openid + "." + name)),
    );
  } catch {
    return null;
  }
}
export async function cacheWrite(name, value) {
  const { openid } = await identity();
  await AsyncStorage.setItem(
    key("cache." + openid + "." + name),
    JSON.stringify(value),
  );
}
export async function currentPlan(value, scope = "recent") {
  const { openid } = await identity(),
    k = key("plans." + openid);
  let plans;
  try {
    plans = JSON.parse(await AsyncStorage.getItem(k)) || {};
  } catch {
    plans = {};
  }
  const recent = Object.entries(plans).sort(
    (a, b) => b[1].updatedAt - a[1].updatedAt,
  )[0];
  if (value === undefined)
    return scope === "recent"
      ? recent?.[1]?.id || (await AsyncStorage.getItem(key("plan." + openid)))
      : plans[scope]?.id || null;
  if (value === null) {
    if (scope === "recent" && recent) delete plans[recent[0]];
    else delete plans[scope];
    await AsyncStorage.removeItem(key("plan." + openid));
  } else plans[scope] = { id: value, updatedAt: Date.now() };
  await AsyncStorage.setItem(k, JSON.stringify(plans));
}
