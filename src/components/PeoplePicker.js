import { filterPeople } from "../utils/people";
import React, { useMemo, useState } from "react";
import { Modal, View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Icon,
  IconButton,
  Button,
  Field,
  Choice,
  Body,
  Pill,
  colors,
  styles,
} from "./ui";
export function PeopleSummary({
  count,
  total,
  scope,
  onPress,
  loading = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="选择学生"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 14,
        backgroundColor: colors.tint,
        gap: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name="people-outline" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.body, { fontWeight: "500" }]}>
          {loading ? "正在同步名单…" : `已选择 ${count} / ${total} 人`}
        </Text>
        <Text style={styles.muted}>{scope}</Text>
      </View>
      <Icon name="chevron-forward" size={18} />
    </Pressable>
  );
}
export default function PeoplePicker({
  visible,
  onClose,
  onConfirm,
  students,
  selected,
  scope,
  detail,
  filterMissing,
}) {
  const [query, Q] = useState(""),
    [ids, I] = useState(selected),
    [mode, M] = useState("all");
  React.useEffect(() => {
    if (visible) {
      I(selected);
      Q("");
      M("all");
    }
  }, [visible]);
  const chosen = useMemo(() => new Set(ids), [ids]),
    list = useMemo(
      () => filterPeople(students, query, mode, chosen, filterMissing),
      [students, query, chosen, mode, filterMissing],
    );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.title}>选择学生</Text>
            <IconButton name="close" label="关闭学生选择" onPress={onClose} />
          </View>
          <Pill>{scope}</Pill>
          <Field
            label="搜索学生"
            placeholder="姓名、学号或专业"
            value={query}
            onChangeText={Q}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              ["all", "全部"],
              ["selected", "已选"],
              ...(filterMissing ? [["missing", "仅看待录入"]] : []),
            ].map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => M(value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor:
                    mode === value ? colors.primary : colors.surface,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: mode === value ? "#FFF" : colors.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Body muted>
              已选 {ids.length} 人 · 匹配 {list.length} 人
            </Body>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="全选当前结果"
                onPress={() =>
                  I((old) => [
                    ...new Set([...old, ...list.map((s) => s.studentId)]),
                  ])
                }
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ fontSize: 14, color: colors.primary }}>
                  选中结果
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消当前搜索结果"
                onPress={() =>
                  I((old) =>
                    old.filter((id) => !list.some((s) => s.studentId === id)),
                  )
                }
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  取消结果
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空选择"
                onPress={() => I([])}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  清空全部
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        <FlatList
          data={list}
          keyExtractor={(s) => s.studentId}
          initialNumToRender={14}
          windowSize={5}
          maxToRenderPerBatch={12}
          extraData={chosen}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
          renderItem={({ item: s }) => (
            <View
              style={{
                paddingHorizontal: 16,
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Choice
                label={s.name}
                detail={s.studentId + (detail ? " · " + detail(s) : "")}
                selected={chosen.has(s.studentId)}
                onPress={() =>
                  I((old) =>
                    chosen.has(s.studentId)
                      ? old.filter((id) => id !== s.studentId)
                      : [...old, s.studentId],
                  )
                }
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ padding: 32 }}>
              <Body muted>没有匹配的学生</Body>
            </View>
          }
        />
        <View
          style={{
            padding: 24,
            borderTopWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Button
            title={`确认选择 ${ids.length} 人`}
            onPress={() => onConfirm(ids)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
