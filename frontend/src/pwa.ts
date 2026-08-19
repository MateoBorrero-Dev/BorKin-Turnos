import type { VitePWAOptions } from "vite-plugin-pwa";

export function isPrivateBackendResource({ url }: { url: URL }) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/health");
}

export const pwaOptions = {
  registerType: "prompt",
  manifest: {
    name: "BorKin Turnos",
    short_name: "BorKin",
    description: "Gestión profesional de turnos, clientes y caja.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    cleanupOutdatedCaches: true,
    globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/health(?:\/|$)/],
    runtimeCaching: (["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) => ({ urlPattern: isPrivateBackendResource, handler: "NetworkOnly" as const, method })),
  },
} satisfies Partial<VitePWAOptions>;
