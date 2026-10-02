"use client";

import { useEffect, useState } from "react";

type ArkemTheme = "light" | "dark";
const STORAGE_KEY = "arkemx-theme";

function applyTheme(theme: ArkemTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", theme === "dark" ? "#000000" : "#f8f9fa");
  }
}

export function ThemeControl() {
  const [theme, setTheme] = useState<ArkemTheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: ArkemTheme = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const chooseTheme = (next: ArkemTheme) => {
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  return <div className="arkem-theme-control" role="group" aria-label="Tema seçimi">
    <span className="arkem-theme-control-label">Tema</span>
    <div className="arkem-theme-control-options">
      <button type="button" aria-pressed={theme === "light"} onClick={() => chooseTheme("light")}>
        <span aria-hidden="true">☀</span> Açık
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => chooseTheme("dark")}>
        <span aria-hidden="true">☾</span> Koyu
      </button>
    </div>
  </div>;
}
