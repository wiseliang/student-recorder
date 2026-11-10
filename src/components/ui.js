import {HeaderHeightContext} from "@react-navigation/elements";
import React, { useRef, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
export const colors = {
  ink: "#172C42",
  muted: "#60758B",
  primary: "#1B62A5",
  surface: "#FFFFFF",
  background: "#EDF4FC",
  line: "#D9E4F0",
  danger: "#AB2836",
  success: "#236A43",
  warning: "#8B5A12",
  tint: "#E3EFFA",
  soft: "#F7FAFE",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#E4ECF5",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: colors.ink,
    lineHeight: 36,
  },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 24 },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 26,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  error: { fontSize: 14, lineHeight: 22, color: colors.danger },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
    backgroundColor: colors.soft,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "500", color: "#FFF" },
  choice: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chosen: { borderColor: colors.primary, backgroundColor: colors.tint },
  number: {
    fontSize: 26,
    fontWeight: "500",
    color: colors.ink,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  sectionLabel: { fontSize: 14, fontWeight: "500", color: colors.muted },
  separator: { height: 1, backgroundColor: colors.line },
});
export function Icon({ name, size = 22, color = colors.primary }) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Page({
  children,
  refreshControl,
  footer,
  scroll = true,
  contentStyle,
}) {
  const inset = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext);
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, {paddingTop:16+(headerHeight?0:inset.top)}, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: 24 }, contentStyle]}>
          {children}
        </View>
      )}
      {footer && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 24,
            paddingTop: 14,
            paddingBottom: Math.max(inset.bottom, 14),
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 672,
              alignSelf: "center",
              gap: 10,
            }}
          >
            {footer}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);
export const Title = ({ children }) => (
  <Text accessibilityRole="header" style={styles.title}>
    {children}
  </Text>
);
export const Body = ({ children, muted = false, style }) => (
  <Text style={[muted ? styles.muted : styles.body, style]}>{children}</Text>
);
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  secondary = false,
  danger = false,
  icon,
  style,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered, focused }) => [
        styles.button,
        secondary && { backgroundColor: colors.tint },
        danger && { backgroundColor: "#F7E7E9" },
        hovered && { opacity: 0.9 },
        pressed && { transform: [{ scale: 0.985 }] },
        (disabled || loading) && { opacity: 0.45 },
        Platform.OS === "web" &&
          focused && {
            outlineWidth: 2,
            outlineColor: colors.primary,
            outlineOffset: 3,
          },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={secondary || danger ? colors.primary : "#FFF"}
        />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={19}
              color={
                secondary ? colors.primary : danger ? colors.danger : "#FFF"
              }
            />
          )}
          <Text
            style={[
              styles.buttonText,
              secondary && { color: colors.primary },
              danger && { color: colors.danger },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({ name, label, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 48,
        width: 48,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.3 : pressed ? 0.65 : 1,
      })}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function ErrorBox({ error, onRetry, onLogin }) {
  if (!error) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: "#F9ECEE",
        borderRadius: 14,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Icon name="alert-circle-outline" color={colors.danger} size={20} />
        <Text style={[styles.error, { flex: 1 }]}>
          {error.message || String(error)}
        </Text>
      </View>
      {onRetry && <Button title="重新加载" onPress={onRetry} secondary />}
      {onLogin && <Button title="连接学校账号" onPress={onLogin} secondary />}
    </View>
  );
}
export function Field({ label, helper, error, style, ...props }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.ink }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          props.multiline && { minHeight: 104, textAlignVertical: "top" },
          error && { borderColor: colors.danger },
          style,
        ]}
        placeholderTextColor="#8194A8"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {helper && <Body muted>{helper}</Body>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
export function Choice({ label, selected, onPress, detail, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.choice,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon
        name={selected ? "checkbox" : "square-outline"}
        color={selected ? colors.primary : "#A8B8C9"}
        size={23}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.body}>{label}</Text>
        {detail && <Text style={styles.muted}>{detail}</Text>}
      </View>
    </Pressable>
  );
}
export function Pill({ children, tone = "neutral" }) {
  const t =
    tone === "success"
      ? [colors.success, "#E5F0E7"]
      : tone === "warning"
        ? [colors.warning, "#F7EEDB"]
        : tone === "danger"
          ? [colors.danger, "#F8E7E9"]
          : [colors.primary, colors.tint];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 4,
        backgroundColor: t[1],
      }}
    >
      <Text
        style={{ fontSize: 13, lineHeight: 18, color: t[0], fontWeight: "500" }}
      >
        {children}
      </Text>
    </View>
  );
}
export function SectionHeader({ title, action, onPress }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center", paddingLeft: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 14 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function RowLink({
  icon,
  title,
  detail,
  onPress,
  last = false,
  accessory,
  danger = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 70,
        paddingVertical: 13,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderBottomWidth: last ? 0 : 1,
        borderColor: colors.line,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: danger ? "#F8E8EA" : colors.tint,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Icon
            name={icon}
            size={21}
            color={danger ? colors.danger : colors.primary}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[
            styles.body,
            { fontWeight: "500", color: danger ? colors.danger : colors.ink },
          ]}
        >
          {title}
        </Text>
        {detail && <Text style={styles.muted}>{detail}</Text>}
      </View>
      {accessory || <Icon name="chevron-forward" size={18} color="#8296AA" />}
    </Pressable>
  );
}
export function MetricRow({ values }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {values.map(([label, value]) => (
        <View key={label} style={{ flex: 1, minWidth: 70, gap: 5 }}>
          <Text style={styles.number}>{value ?? "—"}</Text>
          <Text style={styles.muted}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
export function EmptyState({
  icon = "documents-outline",
  title,
  description,
  action,
  onPress,
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 42, gap: 14 }}>
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 22,
          backgroundColor: colors.tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={30} />
      </View>
      <Text style={styles.heading}>{title}</Text>
      {description && (
        <Text style={[styles.muted, { textAlign: "center", maxWidth: 300 }]}>
          {description}
        </Text>
      )}
      {action && (
        <Button
          title={action}
          onPress={onPress}
          secondary
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}
export function StepHeader({ steps, current }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
      {steps.map((text, index) => (
        <View key={text} style={{ flex: 1, gap: 9 }}>
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: index <= current ? colors.primary : colors.line,
            }}
          />
          <Text
            style={{
              fontSize: 13,
              color: index === current ? colors.primary : colors.muted,
              fontWeight: index === current ? "500" : "400",
            }}
          >
            {index + 1} {text}
          </Text>
        </View>
      ))}
    </View>
  );
}
