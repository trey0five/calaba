/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  /** Overrides the deployed site-API base URL at build time. */
  readonly VITE_API_URL?: string;
}
