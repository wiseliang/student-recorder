import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { get, post } from "../utils/api";
import { ACTIVE } from "../utils/presentation";
import { Page, Card, Body, Button, ErrorBox } from "../components/ui";
import SchoolGate from "../components/SchoolGate";
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
          <TaskView task={task} navigation={navigation} />
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
                      navigation.navigate(
                        task.type === "worklog-talk" ? "WorklogTalk" : "Record",
                        { retryTaskUuid: uuid },
                      )
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
                    <SchoolGate navigation={navigation}>
                      <Button
                        title="只读回查学校记录"
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
                    </SchoolGate>
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
                  navigation.navigate(
                    task.type === "worklog-talk" ? "WorklogTalk" : "Record",
                    {
                      type: task.type === "companion" ? "companion" : "talk",
                    },
                  )
                }
              />
            </>
          )}
        </>
      )}
    </Page>
  );
}
