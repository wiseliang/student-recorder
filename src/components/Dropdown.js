import React, { useState } from "react";
import { Modal, View, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Icon, IconButton, colors, styles } from "./ui";
export default function Dropdown({
  label,
  value,
  options = [],
  onChange,
  helper,
  disabled = false,
}) {
  const [open, S] = useState(false),
    chosen = options.find((o) => o.label === value || o.value === value);
  return (
    <View style={{ gap: 7 }}>
      <Body>{label}</Body>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => S(true)}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.soft,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 50,
        }}
      >
        <Text style={styles.body}>
          {chosen?.label ||
            (options.length ? "请选择学校选项" : "正在读取学校选项…")}
        </Text>
        <Icon name="chevron-down" size={18} />
      </Pressable>
      {helper && <Body muted>{helper}</Body>}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => S(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <Text style={styles.title}>{label}</Text>
            <IconButton
              name="close"
              label={"关闭" + label}
              onPress={() => S(false)}
            />
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen?.value === item.value }}
                accessibilityLabel={item.label}
                onPress={() => {
                  onChange(item.label);
                  S(false);
                }}
                style={{
                  padding: 18,
                  minHeight: 54,
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.body}>{item.label}</Text>
                {chosen?.value === item.value && <Icon name="checkmark" />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
