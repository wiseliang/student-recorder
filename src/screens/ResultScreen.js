import React, { useCallback, useState, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { get, post } from "../utils/api";
import { ACTIVE } from "../utils/presentation";
import { Page, Card, Body, Button, ErrorBox } from "../components/ui";
import { useSchool } from "../state/SchoolContext";
import SchoolGate from "../components/SchoolGate";
import TaskView from "../components/TaskView";
export default function ResultScreen({ route, navigation }) {
  const { school } = useSchool(),
    resumeVerify = useRef(false);
  const uuid = route.params.taskUuid,
    [task, T] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [verify, V] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      get("/api/task/" + uuid, { summary: 1 })
        .then((t) => live && T(t))
        .catch((e) => live && E(e));
      return () => {
        live = false;
      };
    }, [uuid]),
  );
  const verifySchool = async () => {
    B(true);
    E(null);
    try {
      await post("/api/task/" + uuid + "/verify");
      T(await get("/api/task/" + uuid, { summary: 1 }));
    } catch (e) {
      E(e);
      if (["SCHOOL_AUTH_REQUIRED", "SCHOOL_LOGIN_FAILED"].includes(e.code)) {
        resumeVerify.current = true;
        navigation.navigate("SchoolLogin", { force: true });
      }
    } finally {
      B(false);
    }
  };
  useEffect(() => {
    if (school.hasActiveSession && resumeVerify.current) {
      resumeVerify.current = false;
      void verifySchool();
    }
  }, [school.hasActiveSession]);
  const reload = async () => {
    B(true);
    try {
      T(await get("/api/task/" + uuid, { summary: 1 }));
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
                  重试前会重新读取学校记录，并回查不确定项。仅补录确认未保存或未执行的部分；结果仍不确定时，同一学生的相关项继续保留。
                </Body>
                {task.progress?.retryable > 0 && (
                  <Button
                    title="仅检查并重试失败 / 未执行项"
                    onPress={() =>
                      navigation.navigate(
                        task.type === "worklog-talk" ? "WorklogTalk" : "Record",
                        {
                          retryTaskUuid: uuid,
                          entry:
                            task.type === "academic-auto"
                              ? "automatic"
                              : task.type === "companion"
                                ? "companion"
                                : "talk",
                        },
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
                        onPress={verifySchool}
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
                title="更新本次涉及的学校总览"
                secondary
                onPress={() =>
                  navigation.navigate("Overview", {
                    kind: task.type === "worklog-talk" ? "worklog" : "academic",
                    refreshAfterTask: true,
                  })
                }
              />
              <Button
                title="另建一次实际工作记录"
                secondary
                onPress={() =>
                  navigation.navigate(
                    task.type === "worklog-talk" ? "WorklogTalk" : "Record",
                    {
                      entry:
                        task.type === "academic-auto"
                          ? "automatic"
                          : task.type === "companion"
                            ? "companion"
                            : "talk",
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
