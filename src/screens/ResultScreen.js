import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { get, post } from "../utils/api";
import { ACTIVE } from "../utils/presentation";
import { Page, Card, Body, Button, ErrorBox } from "../components/ui";
import SchoolLogin from "../components/SchoolLogin";
import TaskView from "../components/TaskView";
export default function ResultScreen({ route, navigation }) {
  const uuid = route.params.taskUuid,
    [task, T] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [verify, V] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      get("/api/task/" + uuid)
        .then((t) => live && T(t))
        .catch((e) => live && E(e));
      return () => {
        live = false;
      };
    }, [uuid]),
  );
  const reload = async () => {
    B(true);
    try {
      T(await get("/api/task/" + uuid));
      E(null);
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  return (
    <Page>
      <ErrorBox error={error} onRetry={reload} />
      {!task && !error && <Body>正在读取已保存结果…</Body>}
      {task && (
        <>
          <TaskView task={task} />
          {ACTIVE.includes(task.status) ? (
            <Button
              title="任务仍在执行，查看进度"
              onPress={() => navigation.replace("Progress", { taskUuid: uuid })}
            />
          ) : (
            <>
              <Card>
                <Body>
                  失败重试仅包含确定未保存或未执行的项。已保存、已跳过以及结果待回查的项不会自动重复提交。
                </Body>
                {task.details?.some((d) =>
                  ["failed", "planned", "cancelled"].includes(d.status),
                ) && (
                  <Button
                    title="仅检查并重试失败 / 未执行项"
                    onPress={() =>
                      navigation.navigate("Record", { retryTaskUuid: uuid })
                    }
                  />
                )}{" "}
                {!!task.progress?.unconfirmed && (
                  <Button
                    title="登录学校后回查不确定项"
                    secondary
                    onPress={() => V(!verify)}
                  />
                )}{" "}
                {verify && (
                  <>
                    <SchoolLogin onReady={() => {}} />
                    <Button
                      title="执行只读回查，不新增记录"
                      loading={busy}
                      onPress={async () => {
                        B(true);
                        E(null);
                        try {
                          await post("/api/task/" + uuid + "/verify");
                          T(await get("/api/task/" + uuid));
                        } catch (e) {
                          E(e);
                        } finally {
                          B(false);
                        }
                      }}
                    />
                  </>
                )}
                <Button
                  title="刷新结果"
                  secondary
                  loading={busy}
                  onPress={reload}
                />
              </Card>
              <Button
                title="另建一次实际工作记录"
                secondary
                onPress={() =>
                  navigation.navigate("Record", {
                    type: task.type === "companion" ? "companion" : "talk",
                  })
                }
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
