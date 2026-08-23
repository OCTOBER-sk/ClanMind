/// <reference types="vite/client" />

/** Build-time injected app version (vite define). */
declare const __APP_VERSION__: string;

/** Compile-time demo gate (vite define) — false in production builds. */
declare const __DEMO_MODE__: boolean;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
