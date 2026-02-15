const CHUNK_PUBLIC_PATH = "server/instrumentation.js";
const runtime = require("./chunks/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/instrumentation_ts_658412._.js");
runtime.loadChunk("server/chunks/sentry_server_config_ts_b0a73d._.js");
module.exports = runtime.getOrInstantiateRuntimeModule("[project]/instrumentation.ts [instrumentation-edge] (ecmascript)", CHUNK_PUBLIC_PATH).exports;
