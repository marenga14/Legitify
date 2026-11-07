import { ref } from "vue";

export type Theme = "light" | "dark";
const KEY = "legitify.theme";

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Untouched, each side keeps its own look: a dark public site and a light console. */
export const theme = ref<Theme>("dark");

export function applyTheme(inConsole: boolean) {
  theme.value = saved() ?? (inConsole ? "light" : "dark");
  document.documentElement.dataset.theme = theme.value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.value === "dark" ? "#0a0930" : "#f5f4fd");
}

export function toggleTheme() {
  const next: Theme = theme.value === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private windows can refuse storage. The switch still works until the page reloads.
  }
  theme.value = next;
  document.documentElement.dataset.theme = next;
}
