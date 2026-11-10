import React, { useEffect, useRef, useState } from "react";
import { Image, Text } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { get, post } from "../utils/api";
import { Card, Body, Button, Field, Choice, ErrorBox } from "./ui";
export default function SchoolLogin({ onReady }) {
  const [step, S] = useState("loading"),
    [id, I] = useState(""),
    [password, P] = useState(""),
    [show, V] = useState(false),
    [remember, R] = useState(false),
    [saved, H] = useState(false),
    [code, C] = useState(""),
    [image, Q] = useState(""),
    [qrMfa, M] = useState(false),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [expires, X] = useState(0),
    [cool, D] = useState(0);
  const alive = useRef(true),
    flight = useRef(false),
    ready = useRef(false),
    callback = useRef(onReady);
  callback.current = onReady;
  const accept = async (r) => {
    if (!alive.current) return;
    if (r.loggedIn || r.hasActiveSession || r.step === "ready") {
      ready.current = true;
      S("ready");
      await callback.current(r.calendar);
      return;
    }
    if (r.needsCaptcha || r.step === "captcha") {
      Q(r.captchaImage);
      S("captcha");
    } else if (r.needsCode || r.needsMfa || r.step === "mfa") {
      M(!!r.needsMfa);
      C("");
      S("mfa");
    } else if (r.qrcode) {
      Q(r.qrcode);
      X(Date.now() + (r.expiresIn || 300) * 1000);
      S("qr");
    } else S("password");
  };
  const run = async (fn) => {
    if (flight.current) return;
    flight.current = true;
    B(true);
    E(null);
    try {
      await accept(await fn());
    } catch (e) {
      if (alive.current) E(e);
    } finally {
      flight.current = false;
      if (alive.current) B(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    run(async () => {
      const s = await get("/api/auth/session-status");
      const c = await get("/api/auth/credential");
      if (alive.current) H(c.hasCredential);
      return s;
    });
    return () => {
      alive.current = false;
      if (!ready.current) post("/api/auth/release").catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (step !== "qr") return;
    let stopped = false,
      timer;
    const poll = async () => {
      if (stopped || Date.now() > expires) {
        if (!stopped) E(new Error("二维码已到期，请刷新"));
        return;
      }
      if (!flight.current) await run(() => post("/api/auth/qrcode-wait"));
      if (!stopped) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step, expires]);
  useEffect(() => {
    if (!cool) return;
    const t = setTimeout(() => D(0), Math.max(0, cool - Date.now()));
    return () => clearTimeout(t);
  }, [cool]);
  const cancel = () =>
    run(async () => {
      await post("/api/auth/release");
      M(false);
      return { step: "password" };
    });
  const share = async () => {
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw Error("此设备暂不支持系统分享，请使用另一设备扫码");
      const uri = FileSystem.cacheDirectory + "school-qr.png";
      await FileSystem.writeAsStringAsync(uri, image.split("base64,").pop(), {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "分享登录二维码",
      });
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      E(e);
    }
  };
  if (step === "ready")
    return (
      <Card>
        <Body>学校登录已核验</Body>
        <Button
          title="重新核验并同步学期"
          secondary
          onPress={() =>
            run(() =>
              get("/api/auth/academic-calendar").then((calendar) => ({
                loggedIn: true,
                calendar,
              })),
            )
          }
        />
      </Card>
    );
  return (
    <Card>
      <Body>学校身份验证</Body>
      <ErrorBox error={error} />
      {step === "loading" && (
        <Button
          title="重试连接"
          loading={busy}
          onPress={() => run(() => get("/api/auth/session-status"))}
        />
      )}
      {step === "password" && (
        <>
          <Field
            label="学校账号"
            value={id}
            onChangeText={I}
            keyboardType="default"
            autoComplete="username"
          />
          <Field
            label="学校密码（保留原样）"
            value={password}
            onChangeText={P}
            secureTextEntry={!show}
            autoComplete="password"
          />
          <Choice label="显示密码" selected={show} onPress={() => V(!show)} />
          <Choice
            label="认证成功后加密保存到服务器"
            selected={remember}
            onPress={() => R(!remember)}
          />
          <Button
            title="验证账号密码"
            loading={busy}
            disabled={!id.trim() || !password}
            onPress={() =>
              run(() =>
                post("/api/auth/start-login", {
                  studentId: id.trim(),
                  password,
                  remember,
                }),
              )
            }
          />
          {saved && (
            <Button
              title="使用已保存的学校凭证验证"
              secondary
              loading={busy}
              onPress={() => run(() => post("/api/auth/start-login"))}
            />
          )}
          <Button
            title="改用二维码登录"
            secondary
            loading={busy}
            onPress={() => run(() => post("/api/auth/qrcode-start"))}
          />
          <Body muted>保存凭证不等于已通过学校验证。密码不会写入安装包。</Body>
        </>
      )}
      {step === "qr" && (
        <>
          <Body>
            请用另一设备展示后使用 HIT APP
            扫码。同机可分享给支持二维码识别的应用；是否支持识别取决于该应用。二维码最长有效
            5 分钟。
          </Body>
          <Image
            accessibilityLabel="学校登录二维码"
            source={{ uri: image }}
            style={{ width: "100%", height: 260 }}
            resizeMode="contain"
          />
          <Button title="分享二维码" secondary onPress={share} />
          <Button
            title="已扫码，检查登录"
            loading={busy}
            onPress={() => run(() => post("/api/auth/qrcode-wait"))}
          />
          <Button
            title="刷新二维码"
            secondary
            loading={busy}
            onPress={() => run(() => post("/api/auth/qrcode-start"))}
          />
        </>
      )}
      {step === "captcha" && (
        <>
          <Image
            accessibilityLabel="图片验证码"
            source={{ uri: image }}
            style={{ width: "100%", height: 85 }}
            resizeMode="contain"
          />
          <Field label="图片验证码（可含字母）" value={code} onChangeText={C} />
          <Button
            title="提交图片验证码"
            loading={busy}
            disabled={!code.trim()}
            onPress={() =>
              run(() =>
                post("/api/auth/submit-captcha", { captcha: code.trim() }),
              )
            }
          />
        </>
      )}
      {step === "mfa" && (
        <>
          <Body>
            请在 HIT APP 查看本次动态验证码。若未收到，可点击发送验证码。
          </Body>
          <Field
            label="动态验证码"
            value={code}
            onChangeText={C}
            keyboardType="default"
            autoComplete="one-time-code"
          />
          <Button
            title="完成学校验证"
            loading={busy}
            disabled={!code.trim()}
            onPress={() =>
              run(() =>
                post(
                  qrMfa
                    ? "/api/auth/qrcode-submit-code"
                    : "/api/auth/submit-code",
                  { code: code.trim() },
                ),
              )
            }
          />
          <Button
            title="发送 / 重新发送验证码（间隔 60 秒）"
            secondary
            disabled={Date.now() < cool}
            loading={busy}
            onPress={() =>
              run(async () => {
                await post("/api/auth/resend-code");
                D(Date.now() + 60000);
                return { step: "mfa", needsMfa: qrMfa };
              })
            }
          />
        </>
      )}
      {["qr", "mfa", "captcha"].includes(step) && (
        <Button
          title="取消验证，返回密码登录"
          secondary
          loading={busy}
          onPress={cancel}
        />
      )}
    </Card>
  );
}
