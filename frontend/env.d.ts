/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ICON_BASE_URL?: string;
  /** Game version slug used when neither the URL, storage, hostname map nor registry decide. */
  readonly VITE_DEFAULT_GAME_VERSION?: string;
  /** JSON object mapping hostnames to version slugs, e.g. {"prk.example.com":"prk"}. */
  readonly VITE_VERSION_HOSTNAME_MAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
