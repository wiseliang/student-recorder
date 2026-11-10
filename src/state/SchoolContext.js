import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { AppState } from "react-native";
import { get, onSchoolExpired } from "../utils/api";
const SchoolContext = createContext(null);
export function SchoolProvider({ children }) {
  const [school, S] = useState({ loading: true, hasActiveSession: false }),
    [error, E] = useState(null),
    [connectionPrompted, markConnectionPrompted] = useState(false);
  const refreshFlight = useRef(null);
  const refresh = useCallback(() => {
    if (refreshFlight.current) return refreshFlight.current;
    refreshFlight.current = (async () => {
      try {
        const state = await get("/api/auth/session-status");
        S({ ...state, loading: false });
        E(null);
        return state;
      } catch (e) {
        E(e);
        S((s) => ({ ...s, loading: false }));
        throw e;
      }
    })().finally(() => {
      refreshFlight.current = null;
    });
    return refreshFlight.current;
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
    const off = onSchoolExpired(() =>
      S((s) => ({ ...s, hasActiveSession: false, step: "expired" })),
    );
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh().catch(() => {});
    });
    return () => {
      off();
      sub.remove();
    };
  }, [refresh]);
  const connected = async (calendar) => {
    // A status read started before login must finish before fetching the new session.
    if (refreshFlight.current) await refreshFlight.current.catch(() => {});
    if (calendar)
      S((s) => ({ ...s, loading: false, hasActiveSession: true, calendar }));
    await refresh();
  };
  return (
    <SchoolContext.Provider
      value={{
        school,
        error,
        refresh,
        connected,
        connectionPrompted,
        markConnectionPrompted,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}
export const useSchool = () => useContext(SchoolContext);
export function openSchool(navigation, intent, force = false) {
  navigation.navigate("SchoolLogin", { intent, force });
}
