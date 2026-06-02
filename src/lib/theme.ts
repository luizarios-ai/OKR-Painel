export function getTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("okrflow-theme") as "dark" | "light") || "light";
}

export function setTheme(theme: "dark" | "light") {
  localStorage.setItem("okrflow-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.classList.toggle("dark", theme === "dark");
}
