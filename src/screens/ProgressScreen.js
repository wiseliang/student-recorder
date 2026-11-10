import { useForeground } from "../utils/useForeground";
import React, { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { get, post } from "../utils/api";
import { ACTIVE } from "../utils/presentation";
import { Page, Body, Button, ErrorBox } from "../components/ui";
import TaskView from "../components/TaskView";
export default function ProgressScreen({ route, navigation }) {
  const uuid = route.params.taskUuid,
    [task, T] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [generation, G] = useState(0);
  const active = useRef(true);
  const foreground = useForeground();
  useFocusEffect(
    useCallback(() => {
      if (!foreground) return;
      let stopped = false,
        timer,
        controller = new AbortController();
      active.current = true;
      const poll = async () => {
        try {
          const t = await get("/api/task/" + uuid, undefined, {
            signal: controller.signal,
          });
          if (stopped) return;
          T(t);
          E(null);
          if (ACTIVE.includes(t.status)) timer = setTimeout(poll, 2000);
        } catch (e) {
          if (!stopped) E(e);
        }
      };
      poll();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active" && !stopped) {
          clearTimeout(timer);
          controller.abort();
          controller = new AbortController();
          poll();
        }
      });
      return () => {
        stopped = true;
        active.current = false;
        clearTimeout(timer);
        controller.abort();
        sub.remove();
      };
    }, [uuid, generation, foreground]),
  );
  const control = async (action) => {
    B(true);
    E(null);
    try {
      await post("/api/task/" + uuid + "/" + action);
      const t = await get("/api/task/" + uuid);
      if (active.current) {
        T(t);
        G((g) => g + 1);
      }
    } catch (e) {
      if (active.current) E(e);
    } finally {
      if (active.current) B(false);
    }
  };
  return (
    <Page>
      <ErrorBox error={error} onRetry={() => G((g) => g + 1)} />
      {!task && !error && <Body>正在读取任务状态…</Body>}
      {task && (
        <>
          <TaskView task={task} />
          {["running", "awaiting_input"].includes(task.status) && (
            <Button
              title="请求安全暂停"
              loading={busy}
              onPress={() => control("pause")}
            />
          )}{" "}
          {task.status === "paused" && (
            <Button
              title="继续当前任务"
              loading={busy}
              onPress={() => control("resume")}
            />
          )}{" "}
          {ACTIVE.includes(task.status) ? (
            <>
              <Button
                title="请求停止后续录入"
                danger
                loading={busy}
                disabled={task.status === "cancel_requested"}
                onPress={() => control("cancel")}
              />
              <Body muted>
                离开页面或切到后台后任务仍在服务器执行，可从首页或历史继续查看。
              </Body>
            </>
          ) : (
            <Button
              title="查看结果与重试选项"
              onPress={() => navigation.replace("Result", { taskUuid: uuid })}
            />
          )}
        </>
      )}
    </Page>
  );
}
