import type { AppConfig } from "../app-config.js";


/** A worker has no ingress and adds nothing to `AppConfig`; it is kept as a distinct name for readability. */
export type WorkerAppConfig = AppConfig;
