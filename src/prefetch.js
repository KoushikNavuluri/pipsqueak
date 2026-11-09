// Page chunk loaders for lazy imports and prefetching.
export const load = {
  dashboard: () => import("./pages/Dashboard"),
  studio: () => import("./studio/CanvasStudio"),
  create: () => import("./studio/CreateFlow"),
  settings: () => import("./pages/Settings"),
  auth: () => import("./pages/AuthPages"),
};

export function prefetchApp(signedIn) {
  const run = () =>
    (signedIn ? [load.dashboard, load.studio, load.create, load.settings] : [load.auth]).forEach((l) =>
      l().catch(() => {})
    );
  if (typeof window !== "undefined") {
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1200);
  }
}
