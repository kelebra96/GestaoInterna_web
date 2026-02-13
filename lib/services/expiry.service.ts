/**
 * Service for managing expiry reports (Validades) using Supabase.
 * Adapted for the web application.
 */

import { supabase } from '../supabase-client';
import { supabaseAdmin } from '../supabase-admin';
import type {
  ExpiryReport,
  ExpiryStats,
  ExpiryReportWithDays,
  ExpiryDaysFilter,
} from '@/lib/types/expiry';

// Type definitions (a simplified version might be needed if not shared from mobile)
// It's better to have a shared types package. For now, I'll define them here if needed.
// Let's assume the types from mobile can be reused or are already defined in the web project.
// I'll check for a types file in the WEB project.
// Found D:\myinventory\WEB\lib	ypes, will assume they exist there.

const isUuid = (value?: string): boolean => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return !!value && UUID_REGEX.test(value);
};

const mapToExpiryReport = (data: any): ExpiryReport => ({
  id: data.id,
  barcode: data.barcode,
  productName: data.product_name,
  expiryDate: data.expiry_date,
  quantity: data.quantity,
  photoUrl: data.photo_url,
  storeId: data.store_id,
  companyId: data.company_id,
  createdBy: data.created_by,
  status: data.status,
  resolvedAt: data.resolved_at,
  resolvedBy: data.resolved_by,
  location: data.location,
  notes: data.notes,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapToExpiryReportWithDays = (data: any): ExpiryReportWithDays => {
  const report = mapToExpiryReport(data);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(data.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);
  const daysToExpire = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    ...report,
    daysToExpire,
  };
};

/**
 * Fetch reports for a store with optional filtering.
 */
export async function getStoreReports(
  storeId: string,
  daysFilter?: ExpiryDaysFilter,
  includeResolved: boolean = false
): Promise<ExpiryReportWithDays[]> {
  if (!isUuid(storeId)) {
    console.warn('getStoreReports: Invalid storeId provided.');
    return [];
  }

  // Use supabaseAdmin for server-side queries
  let query = supabaseAdmin
    .from('expiry_reports')
    .select('*')
    .eq('store_id', storeId)
    .order('expiry_date', { ascending: true });

  if (!includeResolved) {
    query = query.eq('status', 'active');
  } else {
    query = query.in('status', ['active', 'resolved']);
  }

  if (daysFilter !== null && daysFilter !== undefined) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysFilter);
    query = query.lte('expiry_date', targetDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching store reports:', error);
    throw error;
  }

  return (data || []).map(mapToExpiryReportWithDays);
}

/**
 * Fetch expiry stats for a store.
 */
export async function getStoreStats(storeId: string): Promise<ExpiryStats> {
    if (!isUuid(storeId)) {
      return {
        total: 0,
        d0Count: 0,
        d1Count: 0,
        d3Count: 0,
        d7Count: 0,
        resolvedCount: 0,
        expiredCount: 0,
      };
    }

    // Use supabaseAdmin for server-side queries
    const { data, error } = await supabaseAdmin
      .from('expiry_reports')
      .select('expiry_date, status')
      .eq('store_id', storeId)
      .in('status', ['active', 'resolved', 'expired']);

    if (error) {
      console.error('Error fetching store stats:', error);
      throw error;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: ExpiryStats = {
      total: 0,
      d0Count: 0,
      d1Count: 0,
      d3Count: 0,
      d7Count: 0,
      resolvedCount: 0,
      expiredCount: 0,
    };

    (data || []).forEach((item) => {
      if (item.status === 'resolved') {
        stats.resolvedCount++;
        return;
      }
      if (item.status === 'expired') {
        stats.expiredCount++;
        return;
      }

      stats.total++;

      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) stats.d0Count++;
      else if (diffDays <= 1) stats.d1Count++;
      else if (diffDays <= 3) stats.d3Count++;
      else if (diffDays <= 7) stats.d7Count++;
    });

    return stats;
}

/**
 * Fetch a single report by its ID.
 */
export async function getReport(reportId: string): Promise<ExpiryReport | null> {
  // Use supabaseAdmin for server-side queries
  const { data, error } = await supabaseAdmin
    .from('expiry_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching report:', error);
    throw error;
  }

  return mapToExpiryReport(data);
}

/**
 * Mark a report as resolved.
 */
export async function resolveReport(reportId: string, resolvedBy: string): Promise<void> {
  // Use supabaseAdmin to bypass RLS policies
  const { error } = await supabaseAdmin
    .from('expiry_reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', reportId);

  if (error) {
    console.error('Error resolving report:', error);
    throw error;
  }
}

/**
 * Delete a report (soft delete - sets status to 'deleted').
 */
export async function deleteReport(reportId: string): Promise<void> {
  // Use supabaseAdmin to bypass RLS policies
  const { error } = await supabaseAdmin
    .from('expiry_reports')
    .update({ status: 'deleted' })
    .eq('id', reportId);

  if (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
}

/**
 * Create a new expiry report.
 */
export async function createReport(input: {
  barcode: string;
  productName?: string;
  expiryDate: string;
  quantity: number;
  photoUrl?: string;
  storeId: string;
  companyId?: string;
  createdBy: string;
  location?: string;
  notes?: string;
}): Promise<string> {
  // Use supabaseAdmin to bypass RLS policies
  const { data, error } = await supabaseAdmin
    .from('expiry_reports')
    .insert({
      barcode: input.barcode,
      product_name: input.productName,
      expiry_date: input.expiryDate,
      quantity: input.quantity,
      photo_url: input.photoUrl,
      store_id: input.storeId,
      company_id: input.companyId,
      created_by: input.createdBy,
      location: input.location,
      notes: input.notes,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating report:', error);
    throw error;
  }

  return data.id;
}

/**
 * Upload a photo to Supabase storage.
 */
export async function uploadPhoto(file: File, storeId: string): Promise<string> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const fileName = `expiry-photos/${storeId}/${timestamp}_${randomStr}.jpg`;

  // Use supabaseAdmin to bypass RLS policies on storage
  const { data, error } = await supabaseAdmin.storage
    .from('uploads')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('uploads')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
