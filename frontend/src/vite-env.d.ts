/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SHOW_DEV_OTP?: string;
  readonly VITE_OTP_LENGTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
