// Контрольные условия задания. Этот файл студент не изменяет.
export const profiles = {
  normal: { css: 20, font: 60, image: 80, analytics: 100, tools: 30, app: 160 },
  slow: { css: 100, font: 2200, image: 3800, analytics: 8000, tools: 80, app: 160 },
  race: { css: 20, font: 400, image: 800, analytics: 100, tools: 2400, app: 20 },
  reverse: { css: 100, font: 2000, image: 300, analytics: 2600, tools: 30, app: 1100 },
};

export function resourceDelay(pathname, scenario) {
  const p = profiles[scenario];
  if (pathname.endsWith('.css')) return p.css;
  if (pathname.endsWith('.ttf')) return p.font;
  if (pathname.endsWith('.svg')) return p.image;
  if (pathname === '/js/analytics.js') return p.analytics;
  if (pathname === '/js/tools.js') return p.tools;
  if (pathname === '/js/app.js') return p.app;
  return 0;
}
