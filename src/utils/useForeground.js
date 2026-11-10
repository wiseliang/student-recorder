import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
export function useForeground() {
  const focused = useIsFocused(),
    [state, setState] = useState(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", setState);
    return () => sub.remove();
  }, []);
  return focused && state === "active";
}
