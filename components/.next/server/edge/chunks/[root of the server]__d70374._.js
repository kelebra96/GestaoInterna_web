(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["chunks/[root of the server]__d70374._.js", {

"[externals]/ [external] (node:buffer, cjs)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
const mod = __turbopack_external_require__("node:buffer");

module.exports = mod;
}}),
"[project]/sentry.server.config.ts [instrumentation] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
/**
 * Sentry Configuration - Server Side
 * Configuração do Sentry para o lado do servidor (Node.js/API Routes)
 */ __turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$edge$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/@sentry/nextjs/build/esm/edge/index.js [instrumentation] (ecmascript)");
;
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || ("TURBOPACK compile-time value", "development") || 'development';
if (SENTRY_DSN) {
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$edge$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        // Traces Sample Rate: Adjust this value in production
        // 0.1 = 10% of API requests are traced
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
        // Integrations (Sentry 8.x já inclui HTTP integration por padrão)
        integrations: [],
        // Performance Monitoring
        beforeSend (event, hint) {
            // Custom error filtering
            const error = hint.originalException;
            // Filtrar erros específicos do servidor
            if (error && typeof error === 'object' && 'message' in error) {
                const message = error.message;
                // Ignorar erros de conexão conhecidos
                if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
                    // Log localmente mas não enviar para Sentry
                    console.error('Connection error:', message);
                    return null;
                }
            }
            return event;
        },
        // Ignorar certos tipos de erros
        ignoreErrors: [
            // Erros de timeout esperados
            'Request timeout',
            'AbortError',
            // Erros de validação (já tratados pela aplicação)
            'ValidationError'
        ],
        // Configurações adicionais
        enabled: ENVIRONMENT !== 'development',
        debug: ENVIRONMENT === 'development',
        // Context adicional para debugging
        beforeBreadcrumb (breadcrumb) {
            // Filtrar breadcrumbs sensíveis
            if (breadcrumb.category === 'console') {
                return null; // Não capturar logs de console
            }
            return breadcrumb;
        }
    });
    console.log('✅ Sentry initialized (server)');
} // Silenciado: Sentry DSN não configurado
}}),
"[project]/instrumentation.ts [instrumentation] (ecmascript)": ((__turbopack_context__) => {
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
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    // Inicializar Sentry no edge runtime (se usar)
    if ("TURBOPACK compile-time truthy", 1) {
        await Promise.resolve().then(()=>__turbopack_import__("[project]/sentry.server.config.ts [instrumentation] (ecmascript)"));
    }
}
}}),
"[project]/edge-wrapper.js { MODULE => \"[project]/instrumentation.ts [instrumentation] (ecmascript)\" } [instrumentation] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
self._ENTRIES ||= {};
self._ENTRIES["middleware_instrumentation"] = Promise.resolve().then(()=>__turbopack_import__("[project]/instrumentation.ts [instrumentation] (ecmascript)"));
}}),
}]);

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__d70374._.js.map