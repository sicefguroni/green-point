"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useCallback, useMemo } from "react";

type ThemePreference = "light" | "dark";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemePreference;
  themeFromCookie?: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "theme";
const THEME_COOKIE_NAME = "theme";

function getSystemPreference() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }
  } catch {
    return null;
  }

  return null;
}

function persistTheme(dark: boolean) {
  const themeValue: ThemePreference = dark ? "dark" : "light";

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = themeValue;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeValue);
  } catch {
    // Ignore storage errors and keep the visual theme applied.
  }

  document.cookie = `${THEME_COOKIE_NAME}=${themeValue}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({
  children,
  initialTheme = "light",
  themeFromCookie = false,
}: ThemeProviderProps) {
  const [isDarkMode, setIsDarkMode] = useState(initialTheme === "dark");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const shouldBeDark = themeFromCookie
      ? initialTheme === "dark"
      : storedTheme
        ? storedTheme === "dark"
        : getSystemPreference();

    setIsDarkMode(shouldBeDark);
    persistTheme(shouldBeDark);
  }, [initialTheme, themeFromCookie]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      persistTheme(newValue);
      return newValue;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ isDarkMode, toggleDarkMode }),
    [isDarkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
