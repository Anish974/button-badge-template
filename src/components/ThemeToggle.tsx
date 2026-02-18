import React, { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme") as Theme | null;
  return stored || getSystemTheme();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("theme", theme);
}

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply theme on mount (before any paint, via class)
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const toggle = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {/* Sun */}
      <svg
        className={`h-4 w-4 transition-all duration-300 absolute ${
          theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
        }`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      {/* Moon */}
      <svg
        className={`h-4 w-4 transition-all duration-300 absolute ${
          theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        }`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
};

export default ThemeToggle;
