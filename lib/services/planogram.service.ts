// web/lib/services/planogram.service.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface PlanogramBase {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  type: 'normal' | 'promocional' | 'sazonal' | 'evento';
  category: string;
  status: 'rascunho' | 'publicado' | 'em_revisao' | 'arquivado';
  totalSKUs?: number;
  modules?: any[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  createdByName?: string;
}

export interface CreatePlanogramData {
  name: string;
  description?: string;
  type: 'normal' | 'promocional' | 'sazonal' | 'evento';
  category: string;
  subcategory?: string;
  modules?: any[];
  totalSKUs?: number;
  orgId: string;
  createdBy?: string;
  createdByName?: string;
}

export interface UpdatePlanogramData {
  name?: string;
  description?: string;
  type?: 'normal' | 'promocional' | 'sazonal' | 'evento';
  category?: string;
  status?: 'rascunho' | 'publicado' | 'em_revisao' | 'arquivado';
  modules?: any[];
  totalSKUs?: number;
}

export class PlanogramService {
  /**
   * Lista todos os planogramas base
   */
  async listPlanograms(orgId?: string, status?: string): Promise<PlanogramBase[]> {
    try {
      let query = supabaseAdmin
        .from('planogram_base')
        .select('*')
        .order('updated_at', { ascending: false });

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PlanogramService] Error listing planograms:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        description: row.description,
        type: row.type,
        category: row.category,
        status: row.status,
        totalSKUs: row.total_skus,
        modules: row.modules || [],
        version: row.version,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by,
        createdByName: row.created_by_name,
      }));
    } catch (error) {
      console.error('Error listing planograms:', error);
      throw error;
    }
  }

  /**
   * Busca um planograma por ID
   */
  async getPlanogram(id: string): Promise<PlanogramBase | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('planogram_base')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        orgId: data.org_id,
        name: data.name,
        description: data.description,
        type: data.type,
        category: data.category,
        status: data.status,
        totalSKUs: data.total_skus,
        modules: data.modules || [],
        version: data.version,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        createdByName: data.created_by_name,
      };
    } catch (error) {
      console.error('Error getting planogram:', error);
      throw error;
    }
  }

  /**
   * Cria um novo planograma base
   */
  async createPlanogram(data: CreatePlanogramData): Promise<PlanogramBase> {
    try {
      const now = new Date().toISOString();

      const planogramData = {
        name: data.name,
        description: data.description || '',
        type: data.type,
        category: data.category,
        subcategory: data.subcategory || '',
        status: 'rascunho' as const,
        modules: data.modules || [],
        total_skus: data.totalSKUs || 0,
        version: 1,
        org_id: data.orgId,
        created_by: data.createdBy || null,
        created_by_name: data.createdByName || '',
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error } = await supabaseAdmin
        .from('planogram_base')
        .insert(planogramData)
        .select()
        .single();

      if (error) {
        console.error('[PlanogramService] Error creating planogram:', error);
        throw error;
      }

      return {
        id: inserted.id,
        orgId: inserted.org_id,
        name: inserted.name,
        description: inserted.description,
        type: inserted.type,
        category: inserted.category,
        status: inserted.status,
        totalSKUs: inserted.total_skus,
        modules: inserted.modules || [],
        version: inserted.version,
        createdAt: new Date(inserted.created_at),
        updatedAt: new Date(inserted.updated_at),
        createdBy: inserted.created_by,
        createdByName: inserted.created_by_name,
      };
    } catch (error) {
      console.error('Error creating planogram:', error);
      throw error;
    }
  }

  /**
   * Atualiza um planograma existente
   */
  async updatePlanogram(id: string, data: UpdatePlanogramData): Promise<PlanogramBase> {
    try {
      // Buscar planograma atual para incrementar versão se necessário
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('planogram_base')
        .select('version')
        .eq('id', id)
        .single();

      if (fetchError || !current) {
        throw new Error('Planogram not found');
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Mapear campos camelCase para snake_case
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.modules !== undefined) updateData.modules = data.modules;
      if (data.totalSKUs !== undefined) updateData.total_skus = data.totalSKUs;

      // Incrementar versão se houver mudanças nos módulos
      if (data.modules) {
        updateData.version = (current.version || 1) + 1;
      }

      const { error: updateError } = await supabaseAdmin
        .from('planogram_base')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('[PlanogramService] Error updating planogram:', updateError);
        throw updateError;
      }

      // Buscar planograma atualizado
      const { data: updated, error: refetchError } = await supabaseAdmin
        .from('planogram_base')
        .select('*')
        .eq('id', id)
        .single();

      if (refetchError || !updated) {
        throw new Error('Failed to fetch updated planogram');
      }

      return {
        id: updated.id,
        orgId: updated.org_id,
        name: updated.name,
        description: updated.description,
        type: updated.type,
        category: updated.category,
        status: updated.status,
        totalSKUs: updated.total_skus,
        modules: updated.modules || [],
        version: updated.version,
        createdAt: new Date(updated.created_at),
        updatedAt: new Date(updated.updated_at),
        createdBy: updated.created_by,
        createdByName: updated.created_by_name,
      };
    } catch (error) {
      console.error('Error updating planogram:', error);
      throw error;
    }
  }

  /**
   * Arquiva um planograma (soft delete)
   */
  async archivePlanogram(id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('planogram_base')
        .update({
          status: 'arquivado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[PlanogramService] Error archiving planogram:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error archiving planogram:', error);
      throw error;
    }
  }

  /**
   * Publica um planograma
   */
  async publishPlanogram(id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('planogram_base')
        .update({
          status: 'publicado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[PlanogramService] Error publishing planogram:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error publishing planogram:', error);
      throw error;
    }
  }

  /**
   * Deleta permanentemente um planograma
   */
  async deletePlanogram(id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('planogram_base')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[PlanogramService] Error deleting planogram:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting planogram:', error);
      throw error;
    }
  }

  /**
   * Conta planogramas por status
   */
  async countByStatus(orgId: string): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('planogram_base')
        .select('status')
        .eq('org_id', orgId);

      if (error) {
        console.error('[PlanogramService] Error counting planograms:', error);
        throw error;
      }

      const counts: Record<string, number> = {
        rascunho: 0,
        publicado: 0,
        em_revisao: 0,
        arquivado: 0,
      };

      (data || []).forEach((row: any) => {
        const status = row.status || 'rascunho';
        counts[status] = (counts[status] || 0) + 1;
      });

      return counts;
    } catch (error) {
      console.error('Error counting planograms:', error);
      throw error;
    }
  }
}

export const planogramService = new PlanogramService();
