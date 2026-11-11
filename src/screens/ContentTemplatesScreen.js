import React, { useState, useCallback, useRef } from "react";
import { View, Text, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Field,
  Choice,
  ErrorBox,
  IconButton,
  colors,
  styles,
} from "../components/ui";
import Dropdown from "../components/Dropdown";
import { get, post } from "../utils/api";
const SCOPES = [
  { value: "talk", label: "谈话" },
  { value: "companion", label: "陪伴" },
  { value: "both", label: "谈话与陪伴" },
];
export default function ContentTemplatesScreen() {
  const [data, D] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [edit, S] = useState(null),
    [pendingDelete, X] = useState(null),
    [query, Q] = useState("");
  const lock = useRef(false);
  const load = async () => {
    try {
      D(await get("/api/content-templates"));
      E(null);
    } catch (e) {
      E(e);
    }
  };
  useFocusEffect(
    useCallback(() => {
      let live = true;
      get("/api/content-templates")
        .then((r) => live && D(r))
        .catch((e) => live && E(e));
      return () => {
        live = false;
      };
    }, []),
  );
  const change = async (body) => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    E(null);
    try {
      D(
        await post("/api/content-templates", {
          ...body,
          revision: data.revision,
        }),
      );
      S(null);
      X(null);
    } catch (e) {
      E(e);
      if (e.code === "TEMPLATES_CHANGED") {
        try {
          D(await get("/api/content-templates"));
        } catch {}
        E(e);
      }
    } finally {
      lock.current = false;
      B(false);
    }
  };
  const items = (data?.items || []).filter((t) =>
    (t.title + " " + t.content).includes(query.trim()),
  );
  return (
    <>
      <Page>
        <Title>内容模板库</Title>
        <Body muted>
          为当前应用账号保存。可增删改和停用；只有启用的适用模板参与随机，已生成的预览保持原内容。
        </Body>
        <ErrorBox error={error} />
        <Button secondary title="刷新模板库" disabled={busy} onPress={load} />
        <Button
          title="添加模板"
          disabled={!data || busy}
          onPress={() =>
            S({ title: "", content: "", scope: "talk", enabled: true })
          }
        />
        <Field label="搜索模板" value={query} onChangeText={Q} />
        {data && <Body muted>共 {data.items.length} 条 · 最多100条</Body>}
        {data && !items.length && (
          <Card>
            <Body>没有匹配模板。可添加新模板或调整搜索词。</Body>
          </Card>
        )}
        {items.map((t) => (
          <Card key={t.id}>
            <Text style={[styles.body, { fontWeight: "500" }]}>{t.title}</Text>
            <Body muted>
              {SCOPES.find((s) => s.value === t.scope)?.label} ·{" "}
              {t.enabled ? "已启用" : "已停用"}
            </Body>
            <Body>{t.content}</Body>
            <View style={{ gap: 8 }}>
              <Button
                secondary
                title={"编辑模板：" + t.title}
                disabled={busy}
                onPress={() => S({ ...t })}
              />
              <Button
                secondary
                title={(t.enabled ? "停用：" : "启用：") + t.title}
                disabled={busy}
                onPress={() =>
                  change({
                    action: "update",
                    id: t.id,
                    item: { ...t, enabled: !t.enabled },
                  })
                }
              />
              <Button
                secondary
                title={"删除模板：" + t.title}
                disabled={busy}
                onPress={() => X(t)}
              />
            </View>
          </Card>
        ))}
      </Page>
      <Modal
        visible={!!edit}
        animationType="slide"
        onRequestClose={() => !busy && S(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingHorizontal: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.title}>
              {edit?.id ? "编辑模板" : "添加模板"}
            </Text>
            <IconButton
              name="close"
              label="关闭模板编辑"
              onPress={() => !busy && S(null)}
            />
          </View>
          <Page
            footer={
              <Button
                title="保存模板"
                loading={busy}
                onPress={() =>
                  change({
                    action: edit.id ? "update" : "create",
                    id: edit.id,
                    item: edit,
                  })
                }
              />
            }
          >
            <ErrorBox error={error} />
            <Field
              label="模板标题"
              value={edit?.title || ""}
              onChangeText={(v) => S((t) => ({ ...t, title: v }))}
              maxLength={40}
            />
            <Dropdown
              label="适用记录"
              returnValue
              value={edit?.scope || "talk"}
              options={SCOPES}
              onChange={(v) => S((t) => ({ ...t, scope: v }))}
            />
            <Field
              label="模板内容"
              helper="最多250字，生成预览后仍需按实际工作核对。"
              value={edit?.content || ""}
              onChangeText={(v) => S((t) => ({ ...t, content: v }))}
              maxLength={250}
              multiline
            />
            <Choice
              label="参与随机选择"
              selected={edit?.enabled}
              onPress={() => S((t) => ({ ...t, enabled: !t.enabled }))}
            />
          </Page>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!pendingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => X(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#0005",
          }}
        >
          <Card>
            <Title>删除模板</Title>
            <Body>删除“{pendingDelete?.title}”？已生成的预览内容会保留。</Body>
            <ErrorBox error={error} />
            <Button
              title="确认删除模板"
              loading={busy}
              onPress={() => change({ action: "delete", id: pendingDelete.id })}
            />
            <Button
              secondary
              title="保留模板"
              disabled={busy}
              onPress={() => X(null)}
            />
          </Card>
        </View>
      </Modal>
    </>
  );
}
