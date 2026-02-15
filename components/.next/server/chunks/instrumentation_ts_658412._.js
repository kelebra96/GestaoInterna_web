module.exports = {

"[project]/instrumentation.ts [instrumentation-edge] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
/**
 * Next.js Instrumentation
 * Este arquivo é carregado automaticamente pelo Next.js antes da aplicação iniciar
 * Usado para inicializar Sentry e outros serviços de observabilidade
 *
 * Documentação: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */ __turbopack_esm__({
    "register": (()=>register)
});
async function register() {
    // Inicializar Sentry no servidor
    if ("TURBOPACK compile-time truthy", 1) {
        await __turbopack_require__("[project]/sentry.server.config.ts [instrumentation-edge] (ecmascript, async loader)")(__turbopack_import__);
    }
    // Inicializar Sentry no edge runtime (se usar)
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
}
}}),

};

//# sourceMappingURL=instrumentation_ts_658412._.js.map