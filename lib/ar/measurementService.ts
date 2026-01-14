import { supabase } from '@/lib/supabase-client';
import type { Measurement } from '@/stores/useMeasurementStore';

export interface SavedMeasurement extends Measurement {
  id?: string;
  userId: string;
  productId?: string;
  productName?: string;
  productEan?: string;
  storeId?: string;
  storeName?: string;
  timestamp: string | Date;
  notes?: string;
  imageUrl?: string;
  pointsCount: number;
}

/**
 * Salva uma medição no Supabase
 */
export async function saveMeasurement(
  measurement: Measurement,
  userId: string,
  options?: {
    productId?: string;
    productName?: string;
    productEan?: string;
    storeId?: string;
    storeName?: string;
    notes?: string;
    imageUrl?: string;
    pointsCount: number;
  }
): Promise<string> {
  try {
    const measurementData = {
      user_id: userId,
      length: measurement.length,
      width: measurement.width,
      height: measurement.height,
      volume: measurement.volume,
      volume_m3: measurement.volumeM3,
      product_id: options?.productId || null,
      product_name: options?.productName || null,
      product_ean: options?.productEan || null,
      store_id: options?.storeId || null,
      store_name: options?.storeName || null,
      notes: options?.notes || null,
      image_url: options?.imageUrl || null,
      points_count: options?.pointsCount || 0,
    };

    const { data, error } = await supabase
      .from('ar_measurements')
      .insert(measurementData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Erro ao salvar medição:', error);
      throw error;
    }

    console.log('✅ Medição salva com sucesso:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Erro ao salvar medição:', error);
    throw new Error('Falha ao salvar medição no banco de dados');
  }
}

/**
 * Busca medições de um usuário
 */
export async function getUserMeasurements(
  userId: string,
  limitCount: number = 50
): Promise<SavedMeasurement[]> {
  try {
    const { data, error } = await supabase
      .from('ar_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limitCount);

    if (error) {
      console.error('❌ Erro ao buscar medições:', error);
      throw error;
    }

    // Convert from DB snake_case to app camelCase
    const measurements: SavedMeasurement[] = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      length: row.length,
      width: row.width,
      height: row.height,
      volume: row.volume,
      volumeM3: row.volume_m3,
      productId: row.product_id,
      productName: row.product_name,
      productEan: row.product_ean,
      storeId: row.store_id,
      storeName: row.store_name,
      notes: row.notes,
      imageUrl: row.image_url,
      pointsCount: row.points_count,
      timestamp: row.created_at,
    }));

    return measurements;
  } catch (error) {
    console.error('❌ Erro ao buscar medições:', error);
    throw new Error('Falha ao carregar medições do banco de dados');
  }
}

/**
 * Busca medições de um produto específico
 */
export async function getProductMeasurements(
  productId: string,
  limitCount: number = 20
): Promise<SavedMeasurement[]> {
  try {
    const { data, error } = await supabase
      .from('ar_measurements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limitCount);

    if (error) {
      console.error('❌ Erro ao buscar medições do produto:', error);
      throw error;
    }

    // Convert from DB snake_case to app camelCase
    const measurements: SavedMeasurement[] = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      length: row.length,
      width: row.width,
      height: row.height,
      volume: row.volume,
      volumeM3: row.volume_m3,
      productId: row.product_id,
      productName: row.product_name,
      productEan: row.product_ean,
      storeId: row.store_id,
      storeName: row.store_name,
      notes: row.notes,
      imageUrl: row.image_url,
      pointsCount: row.points_count,
      timestamp: row.created_at,
    }));

    return measurements;
  } catch (error) {
    console.error('❌ Erro ao buscar medições do produto:', error);
    throw new Error('Falha ao carregar medições do produto');
  }
}

/**
 * Calcula a média das medições de um produto (útil para planogramas)
 */
export async function getAverageMeasurements(productId: string): Promise<Measurement | null> {
  try {
    const measurements = await getProductMeasurements(productId);

    if (measurements.length === 0) {
      return null;
    }

    const sum = measurements.reduce(
      (acc, m) => ({
        length: acc.length + m.length,
        width: acc.width + m.width,
        height: acc.height + m.height,
        volume: acc.volume + m.volume,
        volumeM3: acc.volumeM3 + m.volumeM3,
      }),
      { length: 0, width: 0, height: 0, volume: 0, volumeM3: 0 }
    );

    const count = measurements.length;

    return {
      length: parseFloat((sum.length / count).toFixed(2)),
      width: parseFloat((sum.width / count).toFixed(2)),
      height: parseFloat((sum.height / count).toFixed(2)),
      volume: parseFloat((sum.volume / count).toFixed(2)),
      volumeM3: parseFloat((sum.volumeM3 / count).toFixed(6)),
    };
  } catch (error) {
    console.error('❌ Erro ao calcular média de medições:', error);
    return null;
  }
}
