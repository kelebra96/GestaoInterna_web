// ==========================================
// Tipos para Módulo de Importação
// ==========================================

// ==========================================
// Enums
// ==========================================

export type ImportStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type ImportType =
  | 'losses'
  | 'expiry'
  | 'inventory'
  | 'products'
  | 'sales'
  | 'stock_movement';

export type ImportFileFormat = 'csv' | 'xlsx' | 'xls' | 'txt';

export type ColumnDataType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'enum';

export type LossType =
  | 'vencimento'
  | 'avaria'
  | 'roubo'
  | 'quebra'
  | 'ajuste'
  | 'outros';

// ==========================================
// Column Mapping
// ==========================================

export interface ColumnMapping {
  source: string; // Nome da coluna no arquivo (A, B, C ou nome do header)
  target: string; // Nome do campo no sistema
  required: boolean;
  type: ColumnDataType;
  options?: string[]; // Para tipo enum
  format?: string; // Para datas
  transform?: TransformRule[];
}

export interface TransformRule {
  action: 'uppercase' | 'lowercase' | 'trim' | 'pad_left' | 'pad_right' | 'replace' | 'extract';
  params?: Record<string, unknown>;
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'positive' | 'digits' | 'min' | 'max' | 'regex' | 'unique' | 'exists';
  params?: Record<string, unknown>;
  message: string;
}

// ==========================================
// Import Template
// ==========================================

export interface ImportTemplate {
  id: string;
  orgId: string;

  name: string;
  description: string | null;
  importType: ImportType;

  columnMapping: ColumnMapping[];

  fileFormat: ImportFileFormat;
  hasHeader: boolean;
  headerRow: number;
  dataStartRow: number;
  delimiter: string;
  encoding: string;
  dateFormat: string;

  validationRules: ValidationRule[];
  transformations: TransformRule[];

  isActive: boolean;
  isDefault: boolean;

  usageCount: number;
  lastUsedAt: Date | null;

  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDTO {
  name: string;
  description?: string;
  importType: ImportType;
  columnMapping: ColumnMapping[];
  fileFormat?: ImportFileFormat;
  hasHeader?: boolean;
  headerRow?: number;
  dataStartRow?: number;
  delimiter?: string;
  encoding?: string;
  dateFormat?: string;
  validationRules?: ValidationRule[];
  isDefault?: boolean;
}

export interface UpdateTemplateDTO extends Partial<CreateTemplateDTO> {
  isActive?: boolean;
}

// ==========================================
// Import Job
// ==========================================

export interface ImportJob {
  id: string;
  orgId: string;
  storeId: string | null;
  templateId: string | null;

  fileName: string;
  fileSize: number | null;
  fileFormat: ImportFileFormat;
  fileUrl: string | null;

  importType: ImportType;
  config: ImportConfig;

  status: ImportStatus;
  statusMessage: string | null;

  totalRows: number;
  processedRows: number;
  validRows: number;
  errorRows: number;
  skippedRows: number;

  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;

  totalQuantity: number;
  totalValue: number;

  startedAt: Date | null;
  completedAt: Date | null;
  processingTimeMs: number | null;

  createdBy: string;

  canRollback: boolean;
  rolledBackAt: Date | null;
  rolledBackBy: string | null;

  createdAt: Date;
  updatedAt: Date;

  // Relations (populated)
  template?: ImportTemplate;
  errors?: ImportJobError[];
}

export interface ImportConfig {
  columnMapping: ColumnMapping[];
  hasHeader: boolean;
  headerRow: number;
  dataStartRow: number;
  delimiter: string;
  encoding: string;
  dateFormat: string;
  validationRules: ValidationRule[];
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  defaultDate?: string;
}

export interface CreateJobDTO {
  storeId?: string;
  templateId?: string;
  fileName: string;
  fileFormat: ImportFileFormat;
  importType: ImportType;
  config?: Partial<ImportConfig>;
}

// ==========================================
// Import Job Error
// ==========================================

export interface ImportJobError {
  id: string;
  jobId: string;

  rowNumber: number;
  columnName: string | null;
  fieldName: string | null;

  errorType: 'validation' | 'parsing' | 'database' | 'duplicate';
  errorMessage: string;
  errorDetails: Record<string, unknown> | null;

  rawValue: string | null;
  expectedFormat: string | null;

  isCritical: boolean;

  createdAt: Date;
}

// ==========================================
// Import Job Row
// ==========================================

export interface ImportJobRow {
  id: string;
  jobId: string;

  rowNumber: number;
  status: 'pending' | 'valid' | 'invalid' | 'processed' | 'skipped';

  rawData: Record<string, unknown>;
  processedData: Record<string, unknown> | null;

  targetTable: string | null;
  targetId: string | null;

  validationErrors: ValidationError[] | null;

  createdAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

// ==========================================
// Loss Record
// ==========================================

export interface LossRecord {
  id: string;
  orgId: string;
  storeId: string;

  productId: string | null;
  ean: string | null;
  sku: string | null;
  productName: string | null;
  brand: string | null;
  category: string | null;
  supplier: string | null;

  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  salePrice: number | null;
  totalSaleValue: number | null;
  marginLost: number | null;

  lossType: LossType;
  lossReason: string | null;
  lossCategory: string | null;

  occurrenceDate: Date;
  expiryDate: Date | null;

  source: 'import' | 'manual' | 'integration';
  importJobId: string | null;

  metadata: Record<string, unknown>;

  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLossRecordDTO {
  storeId: string;
  productId?: string;
  ean?: string;
  sku?: string;
  productName?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  quantity: number;
  unitCost?: number;
  salePrice?: number;
  lossType: LossType;
  lossReason?: string;
  lossCategory?: string;
  occurrenceDate: Date;
  expiryDate?: Date;
  metadata?: Record<string, unknown>;
}

// ==========================================
// File Preview
// ==========================================

export interface FilePreview {
  fileName: string;
  fileSize: number;
  format: ImportFileFormat;
  totalRows: number;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  detectedMapping?: ColumnMapping[];
  encoding: string;
  delimiter?: string;
}

// ==========================================
// Import Progress
// ==========================================

export interface ImportProgress {
  jobId: string;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  validRows: number;
  errorRows: number;
  percentComplete: number;
  currentPhase: 'validating' | 'processing' | 'finalizing';
  estimatedTimeRemaining: number | null;
  recentErrors: ImportJobError[];
}

// ==========================================
// Analytics
// ==========================================

export interface LossSummary {
  orgId: string;
  storeId: string;
  period: Date;
  lossType: LossType;
  category: string;
  recordCount: number;
  totalQuantity: number;
  totalCost: number;
  totalSaleValue: number;
  totalMarginLost: number;
  productsAffected: number;
  suppliersAffected: number;
}

export interface TopLossProduct {
  orgId: string;
  productId: string;
  ean: string | null;
  productName: string;
  brand: string | null;
  category: string | null;
  occurrenceCount: number;
  totalQuantity: number;
  totalCost: number;
  storesAffected: number;
}

export interface TopLossSupplier {
  orgId: string;
  supplier: string;
  occurrenceCount: number;
  productsAffected: number;
  totalQuantity: number;
  totalCost: number;
}

// ==========================================
// API Responses
// ==========================================

export interface ImportJobResponse {
  success: boolean;
  job: ImportJob;
}

export interface ImportJobsListResponse {
  success: boolean;
  jobs: ImportJob[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface FilePreviewResponse {
  success: boolean;
  preview: FilePreview;
}

export interface ImportProgressResponse {
  success: boolean;
  progress: ImportProgress;
}

// ==========================================
// Helpers
// ==========================================

export function getStatusLabel(status: ImportStatus): string {
  const labels: Record<ImportStatus, string> = {
    pending: 'Pendente',
    validating: 'Validando',
    processing: 'Processando',
    completed: 'Concluído',
    completed_with_errors: 'Concluído com erros',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };
  return labels[status];
}

export function getStatusColor(status: ImportStatus): string {
  const colors: Record<ImportStatus, string> = {
    pending: '#6B7280',
    validating: '#3B82F6',
    processing: '#F59E0B',
    completed: '#22C55E',
    completed_with_errors: '#F97316',
    failed: '#EF4444',
    cancelled: '#9CA3AF',
  };
  return colors[status];
}

export function getImportTypeLabel(type: ImportType): string {
  const labels: Record<ImportType, string> = {
    losses: 'Perdas',
    expiry: 'Vencimentos',
    inventory: 'Inventário',
    products: 'Produtos',
    sales: 'Vendas',
    stock_movement: 'Movimentação',
  };
  return labels[type];
}

export function getLossTypeLabel(type: LossType): string {
  const labels: Record<LossType, string> = {
    vencimento: 'Vencimento',
    avaria: 'Avaria',
    roubo: 'Roubo/Furto',
    quebra: 'Quebra',
    ajuste: 'Ajuste de Inventário',
    outros: 'Outros',
  };
  return labels[type];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// Default column mappings for losses
export const DEFAULT_LOSS_COLUMN_MAPPING: ColumnMapping[] = [
  { source: 'A', target: 'ean', required: true, type: 'string' },
  { source: 'B', target: 'productName', required: true, type: 'string' },
  { source: 'C', target: 'quantity', required: true, type: 'number' },
  { source: 'D', target: 'unitCost', required: false, type: 'currency' },
  { source: 'E', target: 'lossType', required: true, type: 'enum', options: ['vencimento', 'avaria', 'roubo', 'quebra', 'ajuste', 'outros'] },
  { source: 'F', target: 'occurrenceDate', required: true, type: 'date', format: 'DD/MM/YYYY' },
  { source: 'G', target: 'supplier', required: false, type: 'string' },
  { source: 'H', target: 'category', required: false, type: 'string' },
  { source: 'I', target: 'lossReason', required: false, type: 'string' },
];
