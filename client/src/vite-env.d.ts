/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIL_BOND_CONTRACT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
