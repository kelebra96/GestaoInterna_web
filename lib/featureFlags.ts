/**
 * Sistema de Feature Flags
 * Controla recursos habilitados/desabilitados no sistema
 */

import { supabaseAdmin } from './supabase-admin';

export interface FeatureFlags {
  allowUserRegistration: boolean; // Permitir criar nova conta no mobile
  userManagementCard: boolean; // Card de gerenciamento de usuários
  lastUpdated?: Date;
}

const DEFAULT_FEATURES: FeatureFlags = {
  allowUserRegistration: false, // DESABILITADO por padrão
  userManagementCard: true,
};

// Tabela: feature_flags (key VARCHAR PRIMARY KEY, value JSONB, updated_at TIMESTAMP)
// Criar se não existir: CREATE TABLE IF NOT EXISTS feature_flags (key VARCHAR(255) PRIMARY KEY, value JSONB, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());

/**
 * Buscar configurações de feature flags do Supabase
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .eq('key', 'features')
      .single();

    if (error || !data) {
      // Se não existe, criar com valores padrão
      const now = new Date().toISOString();
      await supabaseAdmin
        .from('feature_flags')
        .upsert({
          key: 'features',
          value: {
            ...DEFAULT_FEATURES,
            lastUpdated: now,
          },
          updated_at: now,
        }, { onConflict: 'key' });

      return DEFAULT_FEATURES;
    }

    const flagsData = data.value as FeatureFlags;
    return {
      ...DEFAULT_FEATURES,
      ...flagsData,
    };
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return DEFAULT_FEATURES;
  }
}

/**
 * Atualizar uma feature flag específica
 */
export async function updateFeatureFlag(
  flag: keyof FeatureFlags,
  value: boolean
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Buscar valor atual
    const { data: current } = await supabaseAdmin
      .from('feature_flags')
      .select('value')
      .eq('key', 'features')
      .single();

    const currentValue = (current?.value as FeatureFlags) || {};

    // Atualizar com merge
    await supabaseAdmin
      .from('feature_flags')
      .upsert({
        key: 'features',
        value: {
          ...currentValue,
          [flag]: value,
          lastUpdated: now,
        },
        updated_at: now,
      }, { onConflict: 'key' });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    throw error;
  }
}

/**
 * Atualizar múltiplas feature flags de uma vez
 */
export async function updateFeatureFlags(
  flags: Partial<FeatureFlags>
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Buscar valor atual
    const { data: current } = await supabaseAdmin
      .from('feature_flags')
      .select('value')
      .eq('key', 'features')
      .single();

    const currentValue = (current?.value as FeatureFlags) || {};

    // Atualizar com merge
    await supabaseAdmin
      .from('feature_flags')
      .upsert({
        key: 'features',
        value: {
          ...currentValue,
          ...flags,
          lastUpdated: now,
        },
        updated_at: now,
      }, { onConflict: 'key' });
  } catch (error) {
    console.error('Error updating feature flags:', error);
    throw error;
  }
}

/**
 * Verificar se uma feature está habilitada
 */
export async function isFeatureEnabled(flag: keyof FeatureFlags): Promise<boolean> {
  const features = await getFeatureFlags();
  return features[flag] as boolean;
}
