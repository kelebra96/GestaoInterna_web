-- ============================================================================
-- MÓDULO: Analytics de Vencimentos - Agendamento
-- Criado em: 2026-02-06
-- Descrição: Agenda a tarefa de atualização das Materialized Views
--            usando a extensão pg_cron do Supabase.
-- ============================================================================

-- Garante que a extensão pg_cron esteja disponível
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Revoga permissões padrão para o schema cron para segurança
REVOKE ALL ON SCHEMA cron FROM public;

-- Concede acesso ao usuário postgres (ou outro superusuário)
-- O usuário 'postgres' é o padrão para jobs no Supabase
GRANT USAGE ON SCHEMA cron TO postgres;


-- Remove agendamento antigo se existir, para evitar duplicação
SELECT cron.unschedule('refresh-expiry-analytics-mvs')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh-expiry-analytics-mvs'
);


-- Agenda a atualização das MVs de analytics de vencimento para rodar a cada hora
-- Documentação: https://github.com/citusdata/pg_cron
--
-- '0 * * * *' significa:
-- - Minuto: 0
-- - Hora: * (toda hora)
-- - Dia do mês: * (todo dia)
-- - Mês: * (todo mês)
-- - Dia da semana: * (todo dia da semana)
--
SELECT cron.schedule(
    'refresh-expiry-analytics-mvs', -- Nome do job (deve ser único)
    '0 * * * *',                    -- Roda no minuto 0 de cada hora
    $$ SELECT public.refresh_expiry_analytics_mvs(); $$
);

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON EXTENSION pg_cron IS 'Extensão para agendamento de tarefas no banco de dados.';

DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-expiry-analytics-mvs') THEN
      COMMENT ON TABLE cron.job IS 'Tabela que armazena os jobs agendados pelo pg_cron.';
      -- Infelizmente, não é possível adicionar comentário em uma linha específica.
      -- O comentário abaixo é uma forma de documentar o job criado.
      RAISE NOTICE 'Job "refresh-expiry-analytics-mvs" agendado para rodar a cada hora para atualizar as Materialized Views de Analytics de Vencimentos.';
   END IF;
END;
$$;

-- Para verificar os jobs agendados:
-- SELECT * FROM cron.job;

-- Para verificar o histórico de execuções:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 100;
