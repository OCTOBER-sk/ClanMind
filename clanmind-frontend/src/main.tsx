import './index.css'

/**
 * Boot sequence (FE §196/§308):
 *   validate env → install demo runtime (demo only) → configure API client
 *   → render router shell. Remote sync never blocks first paint.
 */

async function prepare(): Promise<void> {
  const { assertLiveConfig, env } = await import('@/config/env');
  assertLiveConfig();

  // Compile-time gate — production builds eliminate this entire branch
  // (and the src/mocks chunk) at build time.
  if (__DEMO_MODE__) {
    const mocks = await import('@/mocks');
    mocks.installDemoMode();
  }

  const { configureApiClient } = await import('@/api/client');
  configureApiClient({
    baseUrl: env.apiBaseUrl,
    getToken: async () => {
      // P1 wires the Supabase session provider; demo uses a fixed token.
      return __DEMO_MODE__ ? 'demo-token' : null;
    },
  });
}

async function start(): Promise<void> {
  try {
    await prepare();

    const reactModule = await import('react');
    const React = reactModule.default;
    const { StrictMode } = reactModule;
    const { createRoot } = await import('react-dom/client');
    const { App } = await import('./App');

    createRoot(document.getElementById('root')!).render(
      React.createElement(StrictMode, null, React.createElement(App)),
    );
  } catch (error) {
    fatal(error);
  }
}

function fatal(error: unknown): void {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML =
      '<div style="display:flex;height:100vh;align-items:center;justify-content:center;' +
      'font-family:sans-serif;color:#b91c1c;background:#fff;text-align:center;padding:24px">' +
      '<div><h2 style="margin:0 0 8px">ClanMind failed to start</h2>' +
      '<p style="color:#374151;font-size:14px">Local drafts are preserved. ' +
      'Restart the app to try again.</p></div></div>';
  }
  console.error('[boot] fatal', error);
}

void start();
