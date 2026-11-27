export type ResolvedScheme = "light" | "dark";

const STORAGE_KEY = "color-scheme";

export function getSystemScheme(): ResolvedScheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredScheme(): ResolvedScheme | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

export function getResolvedScheme(): ResolvedScheme {
  return getStoredScheme() ?? getSystemScheme();
}

export function applyColorScheme(stored: ResolvedScheme | null): ResolvedScheme {
  const resolved = stored ?? getSystemScheme();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? "light dark";
  }
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

/**
 * Two-state toggle following modern-web-guidance `dark-mode-toggle`:
 * - Target = opposite of currently rendered scheme.
 * - If target matches current system preference, remove stored override so system resumes.
 * - Otherwise store literal override. Never retroactively drop stored overrides on OS change.
 */
export function toggleColorScheme(): ResolvedScheme {
  const current = getResolvedScheme();
  const target: ResolvedScheme = current === "dark" ? "light" : "dark";
  const system = getSystemScheme();

  try {
    if (target === system) {
      localStorage.removeItem(STORAGE_KEY);
      return applyColorScheme(null);
    }
    localStorage.setItem(STORAGE_KEY, target);
    return applyColorScheme(target);
  } catch {
    return applyColorScheme(target === system ? null : target);
  }
}
