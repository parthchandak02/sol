import type { SolSettings } from "./sol-settings";

export type SolRasterRequest = {
  backingHeight: number;
  backingWidth: number;
  height: number;
  id: number;
  settings: SolSettings;
  width: number;
};
export type SolRasterResponse = { bitmap?: ImageBitmap; error?: string; id: number };
