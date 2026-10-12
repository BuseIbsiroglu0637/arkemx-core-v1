import { existsSync } from 'node:fs';

// Use an ordinary isolated Playwright browser. Never use the user's profile,
// disable browser protections, or retry a source challenge in another browser.
export function landBrowserLaunchOptions({ chromiumPath, platform = process.platform, exists = existsSync, channel = process.env.ARKEMX_LAND_BROWSER_CHANNEL } = {}) {
  const selected = channel?.trim();
  if (selected && !['chromium', 'msedge'].includes(selected)) throw Error('Unsupported land browser channel');
  if (selected === 'msedge' || (!selected && platform === 'win32' && chromiumPath && !exists(chromiumPath))) {
    return { headless: true, channel: 'msedge' };
  }
  return { headless: true };
}

export async function launchLandBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch(landBrowserLaunchOptions({ chromiumPath: chromium.executablePath() }));
}
