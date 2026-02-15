module.exports = {

"[externals]/ [external] (@sentry/nextjs, cjs)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
const mod = __turbopack_external_require__("@sentry/nextjs");

module.exports = mod;
}}),
"[project]/sentry.server.config.ts [instrumentation-edge] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
/**
 * Sentry Configuration - Server Side
 * Configuração do Sentry para o lado do servidor (Node.js/API Routes)
 */ __turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$sentry$2f$nextjs$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@sentry/nextjs, cjs)");
;
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || ("TURBOPACK compile-time value", "development") || 'development';
if (SENTRY_DSN) {
    __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$sentry$2f$nextjs$2c$__cjs$29$__.init({
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

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__04bf19._.js.map