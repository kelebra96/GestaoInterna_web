import { useState, useCallback } from 'react';
import {
  ImportTemplate,
  ImportJob,
  ImportJobError,
  FilePreview,
  ImportType,
  ImportStatus,
  LossRecord,
  LossSummary,
  TopLossProduct,
  TopLossSupplier,
} from '@/lib/types/import';

// ==========================================
// useImportTemplates
// ==========================================

export function useImportTemplates(importType?: ImportType) {
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (importType) params.set('type', importType);

      const res = await fetch(`/api/imports/templates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch templates');

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [importType]);

  const createTemplate = useCallback(
    async (template: Partial<ImportTemplate>): Promise<ImportTemplate | null> => {
      try {
        const res = await fetch('/api/imports/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        });

        if (!res.ok) throw new Error('Failed to create template');

        const data = await res.json();
        setTemplates((prev) => [...prev, data.template]);
        return data.template;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
  };
}

// ==========================================
// useImportJobs
// ==========================================

export function useImportJobs(options?: {
  importType?: ImportType;
  storeId?: string;
}) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pagination.pageSize));
        if (options?.importType) params.set('type', options.importType);
        if (options?.storeId) params.set('storeId', options.storeId);

        const res = await fetch(`/api/imports/jobs?${params}`);
        if (!res.ok) throw new Error('Failed to fetch jobs');

        const data = await res.json();
        setJobs(data.jobs || []);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [options?.importType, options?.storeId, pagination.pageSize]
  );

  const getJobDetails = useCallback(
    async (
      jobId: string,
      includeErrors = false
    ): Promise<{ job: ImportJob; errors?: ImportJobError[] } | null> => {
      try {
        const params = new URLSearchParams();
        if (includeErrors) params.set('includeErrors', 'true');

        const res = await fetch(`/api/imports/jobs/${jobId}?${params}`);
        if (!res.ok) throw new Error('Failed to fetch job details');

        const data = await res.json();
        return { job: data.job, errors: data.errors };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  const rollbackJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/imports/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to rollback job');

      // Atualizar lista local
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, canRollback: false, rolledBackAt: new Date() } : j
        )
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  return {
    jobs,
    pagination,
    loading,
    error,
    fetchJobs,
    getJobDetails,
    rollbackJob,
  };
}

// ==========================================
// useFileImport
// ==========================================

interface ImportResult {
  job: ImportJob;
  preview?: FilePreview;
  error?: string;
}

export function useFileImport() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewFile = useCallback(
    async (
      file: File,
      options?: { delimiter?: string; hasHeader?: boolean }
    ): Promise<FilePreview | null> => {
      try {
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        if (options?.delimiter) formData.append('delimiter', options.delimiter);
        if (options?.hasHeader !== undefined)
          formData.append('hasHeader', String(options.hasHeader));

        const res = await fetch('/api/imports/preview', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to preview file');
        }

        const data = await res.json();
        setPreview(data.preview);
        return data.preview;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const importFile = useCallback(
    async (
      file: File,
      storeId: string,
      importType: ImportType,
      options?: {
        templateId?: string;
        config?: Record<string, unknown>;
      }
    ): Promise<ImportResult | null> => {
      try {
        setUploading(true);
        setProgress(0);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('storeId', storeId);
        formData.append('importType', importType);
        if (options?.templateId) formData.append('templateId', options.templateId);
        if (options?.config) formData.append('config', JSON.stringify(options.config));

        const res = await fetch('/api/imports/jobs', {
          method: 'POST',
          body: formData,
        });

        setProgress(100);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to import file');
        }

        const data = await res.json();
        return {
          job: data.job,
          preview: data.preview,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { job: {} as ImportJob, error: message };
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setPreview(null);
    setProgress(0);
    setError(null);
  }, []);

  return {
    uploading,
    progress,
    preview,
    error,
    previewFile,
    importFile,
    reset,
  };
}

// ==========================================
// useLossRecords
// ==========================================

export function useLossRecords(options?: {
  storeId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const [records, setRecords] = useState<LossRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pagination.pageSize));
        if (options?.storeId) params.set('storeId', options.storeId);
        if (options?.startDate)
          params.set('startDate', options.startDate.toISOString().split('T')[0]);
        if (options?.endDate)
          params.set('endDate', options.endDate.toISOString().split('T')[0]);

        const res = await fetch(`/api/losses?${params}`);
        if (!res.ok) throw new Error('Failed to fetch records');

        const data = await res.json();
        setRecords(data.records || []);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [options?.storeId, options?.startDate, options?.endDate, pagination.pageSize]
  );

  return {
    records,
    pagination,
    loading,
    error,
    fetchRecords,
  };
}

// ==========================================
// useLossAnalytics
// ==========================================

interface LossAnalytics {
  totals: {
    recordCount: number;
    totalQuantity: number;
    totalCost: number;
    totalSaleValue: number;
    totalMarginLost: number;
  };
  byLossType: Record<string, { recordCount: number; totalCost: number }>;
  byCategory: Record<string, { recordCount: number; totalCost: number }>;
  topProducts: TopLossProduct[];
  topSuppliers: TopLossSupplier[];
  monthlySummary: LossSummary[];
}

export function useLossAnalytics(storeId?: string) {
  const [analytics, setAnalytics] = useState<LossAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (storeId) params.set('storeId', storeId);

      const res = await fetch(`/api/losses/analytics?${params}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');

      const data = await res.json();
      setAnalytics(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  return {
    analytics,
    loading,
    error,
    fetchAnalytics,
  };
}
