import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Body, Button, Field, ErrorBox } from "./ui";
import Dropdown from "./Dropdown";
import { get } from "../utils/api";
export default function ContentComposer({
  mode,
  onMode,
  content,
  onContent,
  entry,
  navigation,
}) {
  const [library, L] = useState(null),
    [error, E] = useState(null),
    [selected, S] = useState("");
  const load = async () => {
    try {
      L(await get("/api/content-templates"));
      E(null);
    } catch (e) {
      E(e);
    }
  };
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      get("/api/content-templates")
        .then((r) => alive && L(r))
        .catch((e) => alive && E(e));
      return () => {
        alive = false;
      };
    }, []),
  );
  const items = (library?.items || []).filter(
    (t) =>
      t.enabled &&
      (entry === "automatic" ||
        t.scope === "both" ||
        t.scope === (entry === "companion" ? "companion" : "talk")),
  );
  return (
    <>
      <Dropdown
        label="内容填写方式"
        returnValue
        value={mode}
        onChange={onMode}
        options={[
          { value: "manual", label: "手动填写 / 使用固定模板" },
          { value: "random", label: "随机模板" },
        ]}
      />
      <ErrorBox error={error} />
      {error && <Button secondary title="重新读取模板库" onPress={load} />}
      {mode === "random" ? (
        <Body muted>
          从已启用且适用的模板中逐条随机选择。当前可用 {items.length}{" "}
          条；生成后请核对实际内容，可逐条修改。
        </Body>
      ) : (
        <>
          {!!items.length && (
            <Dropdown
              label="从模板填入"
              returnValue
              value={selected}
              placeholder="选择主题，将内容填入下方"
              options={items.map((t) => ({ value: t.id, label: t.title }))}
              onChange={(id) => {
                const t = items.find((t) => t.id === id);
                S(id);
                if (t) onContent(t.content);
              }}
            />
          )}
          <Field
            label="谈话 / 工作内容（选填）"
            helper="可以留空，也可在预览中逐人修改，最多250字。"
            value={content}
            onChangeText={onContent}
            multiline
            maxLength={250}
          />
        </>
      )}
      <Button
        secondary
        title="管理内容模板"
        onPress={() => navigation.navigate("ContentTemplates")}
      />
    </>
  );
}
