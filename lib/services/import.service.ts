import { createClient } from '@supabase/supabase-js';
import {
  ImportTemplate,
  ImportJob,
  ImportJobError,
  ImportConfig,
  ImportStatus,
  ImportType,
  ImportFileFormat,
  LossRecord,
  LossType,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  CreateJobDTO,
  CreateLossRecordDTO,
  FilePreview,
  ColumnMapping,
  ValidationRule,
  LossSummary,
  TopLossProduct,
  TopLossSupplier,
  DEFAULT_LOSS_COLUMN_MAPPING,
} from '../types/import';
import { parse as parseCSV } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// ==========================================
// Import Service
// ==========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export class ImportService {
  // ==========================================
  // Templates
  // ==========================================

  async getTemplates(orgId: string, importType?: ImportType): Promise<ImportTemplate[]> {
    let query = supabaseAdmin
      .from('import_templates')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (importType) {
      query = query.eq('import_type', importType);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return (data || []).map(this.mapTemplateFromDb);
  }

  async getTemplateById(templateId: string): Promise<ImportTemplate | null> {
    const { data, error } = await supabaseAdmin
      .from('import_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return this.mapTemplateFromDb(data);
  }

  async createTemplate(orgId: string, userId: string, dto: CreateTemplateDTO): Promise<ImportTemplate> {
    const { data, error } = await supabaseAdmin
      .from('import_templates')
      .insert({
        org_id: orgId,
        name: dto.name,
        description: dto.description,
        import_type: dto.importType,
        column_mapping: dto.columnMapping,
        file_format: dto.fileFormat || 'csv',
        has_header: dto.hasHeader ?? true,
        header_row: dto.headerRow ?? 1,
        data_start_row: dto.dataStartRow ?? 2,
        delimiter: dto.delimiter ?? ',',
        encoding: dto.encoding ?? 'utf-8',
        date_format: dto.dateFormat ?? 'DD/MM/YYYY',
        validation_rules: dto.validationRules || [],
        is_default: dto.isDefault ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return this.mapTemplateFromDb(data);
  }

  async updateTemplate(templateId: string, dto: UpdateTemplateDTO): Promise<ImportTemplate> {
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.columnMapping !== undefined) updateData.column_mapping = dto.columnMapping;
    if (dto.fileFormat !== undefined) updateData.file_format = dto.fileFormat;
    if (dto.hasHeader !== undefined) updateData.has_header = dto.hasHeader;
    if (dto.headerRow !== undefined) updateData.header_row = dto.headerRow;
    if (dto.dataStartRow !== undefined) updateData.data_start_row = dto.dataStartRow;
    if (dto.delimiter !== undefined) updateData.delimiter = dto.delimiter;
    if (dto.encoding !== undefined) updateData.encoding = dto.encoding;
    if (dto.dateFormat !== undefined) updateData.date_format = dto.dateFormat;
    if (dto.validationRules !== undefined) updateData.validation_rules = dto.validationRules;
    if (dto.isDefault !== undefined) updateData.is_default = dto.isDefault;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

    const { data, error } = await supabaseAdmin
      .from('import_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update template: ${error.message}`);
    return this.mapTemplateFromDb(data);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('import_templates')
      .update({ is_active: false })
      .eq('id', templateId);

    if (error) throw new Error(`Failed to delete template: ${error.message}`);
  }

  // ==========================================
  // Jobs
  // ==========================================

  async getJobs(
    orgId: string,
    options?: {
      importType?: ImportType;
      status?: ImportStatus[];
      storeId?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ jobs: ImportJob[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from('import_jobs')
      .select('*, template:import_templates(*)', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options?.importType) {
      query = query.eq('import_type', options.importType);
    }

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }

    if (options?.storeId) {
      query = query.eq('store_id', options.storeId);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
    return {
      jobs: (data || []).map(this.mapJobFromDb),
      total: count || 0,
    };
  }

  async getJobById(jobId: string): Promise<ImportJob | null> {
    const { data, error } = await supabaseAdmin
      .from('import_jobs')
      .select('*, template:import_templates(*)')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch job: ${error.message}`);
    }

    return this.mapJobFromDb(data);
  }

  async getJobErrors(jobId: string, limit = 100): Promise<ImportJobError[]> {
    const { data, error } = await supabaseAdmin
      .from('import_job_errors')
      .select('*')
      .eq('job_id', jobId)
      .order('row_number', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch job errors: ${error.message}`);
    return (data || []).map(this.mapErrorFromDb);
  }

  async createJob(orgId: string, userId: string, dto: CreateJobDTO): Promise<ImportJob> {
    // Buscar template se fornecido
    let config: ImportConfig;

    if (dto.templateId) {
      const template = await this.getTemplateById(dto.templateId);
      if (!template) throw new Error('Template not found');

      config = {
        columnMapping: template.columnMapping,
        hasHeader: template.hasHeader,
        headerRow: template.headerRow,
        dataStartRow: template.dataStartRow,
        delimiter: template.delimiter,
        encoding: template.encoding,
        dateFormat: template.dateFormat,
        validationRules: template.validationRules,
        ...dto.config,
      };
    } else {
      config = {
        columnMapping: dto.config?.columnMapping || DEFAULT_LOSS_COLUMN_MAPPING,
        hasHeader: dto.config?.hasHeader ?? true,
        headerRow: dto.config?.headerRow ?? 1,
        dataStartRow: dto.config?.dataStartRow ?? 2,
        delimiter: dto.config?.delimiter ?? ',',
        encoding: dto.config?.encoding ?? 'utf-8',
        dateFormat: dto.config?.dateFormat ?? 'DD/MM/YYYY',
        validationRules: dto.config?.validationRules || [],
        ...dto.config,
      };
    }

    const { data, error } = await supabaseAdmin
      .from('import_jobs')
      .insert({
        org_id: orgId,
        store_id: dto.storeId,
        template_id: dto.templateId,
        file_name: dto.fileName,
        file_format: dto.fileFormat,
        import_type: dto.importType,
        config,
        created_by: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create job: ${error.message}`);
    return this.mapJobFromDb(data);
  }

  async updateJobStatus(
    jobId: string,
    status: ImportStatus,
    message?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (message) updateData.status_message = message;

    if (status === 'validating' || status === 'processing') {
      updateData.started_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('import_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) throw new Error(`Failed to update job status: ${error.message}`);
  }

  async updateJobProgress(
    jobId: string,
    processed: number,
    valid: number,
    errors: number
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('import_jobs')
      .update({
        processed_rows: processed,
        valid_rows: valid,
        error_rows: errors,
      })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to update job progress: ${error.message}`);
  }

  async completeJob(
    jobId: string,
    stats: {
      status: ImportStatus;
      recordsCreated: number;
      recordsUpdated: number;
      totalQuantity: number;
      totalValue: number;
      message?: string;
    }
  ): Promise<void> {
    const { error } = await supabaseAdmin.rpc('complete_import_job', {
      p_job_id: jobId,
      p_status: stats.status,
      p_records_created: stats.recordsCreated,
      p_records_updated: stats.recordsUpdated,
      p_total_quantity: stats.totalQuantity,
      p_total_value: stats.totalValue,
      p_message: stats.message,
    });

    if (error) throw new Error(`Failed to complete job: ${error.message}`);
  }

  async addJobError(
    jobId: string,
    error: Omit<ImportJobError, 'id' | 'jobId' | 'createdAt'>
  ): Promise<void> {
    const { error: dbError } = await supabaseAdmin
      .from('import_job_errors')
      .insert({
        job_id: jobId,
        row_number: error.rowNumber,
        column_name: error.columnName,
        field_name: error.fieldName,
        error_type: error.errorType,
        error_message: error.errorMessage,
        error_details: error.errorDetails,
        raw_value: error.rawValue,
        expected_format: error.expectedFormat,
        is_critical: error.isCritical,
      });

    if (dbError) console.error('Failed to add job error:', dbError);
  }

  async rollbackJob(jobId: string, userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('rollback_import_job', {
      p_job_id: jobId,
      p_user_id: userId,
    });

    if (error) throw new Error(`Failed to rollback job: ${error.message}`);
    return data as number;
  }

  // ==========================================
  // File Processing
  // ==========================================

  async previewFile(
    fileContent: string | Buffer,
    format: ImportFileFormat,
    options?: {
      delimiter?: string;
      encoding?: string;
      hasHeader?: boolean;
    }
  ): Promise<FilePreview> {
    const delimiter = options?.delimiter || ',';
    const hasHeader = options?.hasHeader ?? true;

    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    if (format === 'csv' || format === 'txt') {
      const content = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');

      const parsed = parseCSV(content, {
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
        delimiter,
        relax_column_count: true,
      });

      if (hasHeader && parsed.length > 0) {
        headers = Object.keys(parsed[0] as object);
        rows = parsed as unknown as Record<string, unknown>[];
      } else {
        // Se não tem header, criar headers A, B, C...
        const firstRow = parsed[0] as string[];
        headers = firstRow.map((_, i) => String.fromCharCode(65 + i));
        rows = (parsed as string[][]).map((row: string[]) => {
          const obj: Record<string, unknown> = {};
          row.forEach((val, i) => {
            obj[headers[i]] = val;
          });
          return obj;
        });
      }
    } else if (format === 'xlsx' || format === 'xls') {
      const workbook = XLSX.read(fileContent, { type: typeof fileContent === 'string' ? 'string' : 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: hasHeader ? undefined : 1,
        raw: false,
      });

      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0] as object);
        rows = jsonData as Record<string, unknown>[];
      }
    }

    // Detectar mapeamento automático
    const detectedMapping = this.detectColumnMapping(headers);

    return {
      fileName: 'preview',
      fileSize: typeof fileContent === 'string' ? fileContent.length : fileContent.length,
      format,
      totalRows: rows.length,
      headers,
      sampleRows: rows.slice(0, 10),
      detectedMapping,
      encoding: 'utf-8',
      delimiter: format === 'csv' || format === 'txt' ? delimiter : undefined,
    };
  }

  private detectColumnMapping(headers: string[]): ColumnMapping[] {
    const mapping: ColumnMapping[] = [];

    const fieldPatterns: Record<string, RegExp[]> = {
      ean: [/ean/i, /código.*barra/i, /barcode/i, /gtin/i],
      productName: [/descri[cç][aã]o/i, /produto/i, /name/i, /item/i],
      quantity: [/qtd/i, /quantidade/i, /qty/i, /quantity/i],
      unitCost: [/custo/i, /pre[cç]o.*custo/i, /cost/i],
      salePrice: [/pre[cç]o.*venda/i, /pvp/i, /sale.*price/i, /valor/i],
      lossType: [/tipo.*perda/i, /motivo/i, /reason/i, /loss.*type/i],
      occurrenceDate: [/data/i, /date/i, /ocorr[eê]ncia/i],
      supplier: [/fornecedor/i, /supplier/i, /vendor/i],
      category: [/categoria/i, /category/i, /grupo/i],
      brand: [/marca/i, /brand/i],
      sku: [/sku/i, /c[oó]digo.*interno/i, /internal.*code/i],
    };

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const colLetter = String.fromCharCode(65 + i);

      for (const [field, patterns] of Object.entries(fieldPatterns)) {
        if (patterns.some(p => p.test(header))) {
          const existing = DEFAULT_LOSS_COLUMN_MAPPING.find(m => m.target === field);

          mapping.push({
            source: colLetter,
            target: field,
            required: existing?.required || false,
            type: existing?.type || 'string',
            options: existing?.options,
            format: existing?.format,
          });
          break;
        }
      }
    }

    return mapping;
  }

  async processLossImport(
    jobId: string,
    orgId: string,
    storeId: string,
    rows: Record<string, unknown>[],
    config: ImportConfig,
    userId: string
  ): Promise<{
    recordsCreated: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    let recordsCreated = 0;
    let totalQuantity = 0;
    let totalValue = 0;
    let processedRows = 0;
    let validRows = 0;
    let errorRows = 0;

    const lossRecords: Omit<LossRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      processedRows++;

      try {
        // Mapear dados
        const mapped = this.mapRowToLossRecord(row, config.columnMapping, config.dateFormat);

        // Aplicar defaults antes da validação
        // Derivar lossType do lossReason se não estiver mapeado
        if (!mapped.lossType && mapped.lossReason) {
          const motivo = String(mapped.lossReason).toUpperCase();
          const motivoToType: Record<string, LossType> = {
            'PRAZO DE VALIDADE VENCIDO': 'vencimento',
            'VALIDADE': 'vencimento',
            'VENCIDO': 'vencimento',
            'AVARIA': 'avaria',
            'QUEBRA': 'quebra',
            'ROUBO': 'roubo',
            'FURTO': 'roubo',
            'AJUSTE': 'ajuste',
          };
          for (const [key, value] of Object.entries(motivoToType)) {
            if (motivo.includes(key)) {
              mapped.lossType = value as LossType;
              break;
            }
          }
          if (!mapped.lossType) {
            mapped.lossType = 'outros';
          }
        } else if (!mapped.lossType) {
          mapped.lossType = 'outros';
        }

        // Usar data padrão do config se não houver data mapeada
        if (!mapped.occurrenceDate && config.defaultDate) {
          mapped.occurrenceDate = new Date(config.defaultDate);
        } else if (!mapped.occurrenceDate) {
          mapped.occurrenceDate = new Date();
        }

        // Validar
        const errors = this.validateLossRecord(mapped, config.validationRules);

        if (errors.length > 0) {
          errorRows++;
          for (const err of errors) {
            await this.addJobError(jobId, {
              rowNumber: i + config.dataStartRow,
              columnName: null,
              fieldName: err.field,
              errorType: 'validation',
              errorMessage: err.message,
              errorDetails: null,
              rawValue: String(err.value),
              expectedFormat: null,
              isCritical: false,
            });
          }
          continue;
        }

        validRows++;

        // Calcular valores
        const unitCost = mapped.unitCost || 0;
        const quantity = mapped.quantity || 0;
        const totalCost = unitCost * quantity;
        const salePrice = mapped.salePrice || 0;
        const totalSaleValue = salePrice * quantity;
        const marginLost = totalSaleValue - totalCost;

        lossRecords.push({
          orgId,
          storeId,
          productId: null, // TODO: Buscar por EAN
          ean: mapped.ean || null,
          sku: mapped.sku || null,
          productName: mapped.productName || null,
          brand: mapped.brand || null,
          category: mapped.category || null,
          supplier: mapped.supplier || null,
          quantity,
          unitCost,
          totalCost,
          salePrice,
          totalSaleValue,
          marginLost,
          lossType: mapped.lossType || 'outros',
          lossReason: mapped.lossReason || null,
          lossCategory: mapped.lossCategory || null,
          occurrenceDate: mapped.occurrenceDate || new Date(),
          expiryDate: mapped.expiryDate || null,
          source: 'import',
          importJobId: jobId,
          metadata: {},
          createdBy: userId,
        });

        totalQuantity += quantity;
        totalValue += totalCost;

        // Atualizar progresso a cada 100 linhas
        if (processedRows % 100 === 0) {
          await this.updateJobProgress(jobId, processedRows, validRows, errorRows);
        }
      } catch (err) {
        errorRows++;
        await this.addJobError(jobId, {
          rowNumber: i + config.dataStartRow,
          columnName: null,
          fieldName: null,
          errorType: 'parsing',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          errorDetails: null,
          rawValue: JSON.stringify(row),
          expectedFormat: null,
          isCritical: false,
        });
      }
    }

    // Inserir em batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < lossRecords.length; i += BATCH_SIZE) {
      const batch = lossRecords.slice(i, i + BATCH_SIZE);

      const insertData = batch.map(r => ({
        company_id: r.orgId,
        store_id: r.storeId,
        product_id: r.productId,
        ean: r.ean,
        sku: r.sku,
        product_name: r.productName,
        brand: r.brand,
        category: r.category,
        supplier: r.supplier,
        quantity: r.quantity,
        unit_cost: r.unitCost,
        total_cost: r.totalCost,
        sale_price: r.salePrice,
        total_sale_value: r.totalSaleValue,
        margin_lost: r.marginLost,
        loss_type: r.lossType,
        loss_reason: r.lossReason,
        loss_category: r.lossCategory,
        occurrence_date: r.occurrenceDate.toISOString().split('T')[0],
        expiry_date: r.expiryDate?.toISOString().split('T')[0],
        source: r.source,
        import_job_id: r.importJobId,
        metadata: r.metadata,
        created_by: r.createdBy,
      }));

      const { error } = await supabaseAdmin
        .from('loss_records')
        .insert(insertData);

      if (error) {
        console.error('Failed to insert loss records batch:', error);
        throw error;
      }

      recordsCreated += batch.length;
    }

    // Atualizar progresso final
    await this.updateJobProgress(jobId, processedRows, validRows, errorRows);

    return { recordsCreated, totalQuantity, totalValue };
  }

  private mapRowToLossRecord(
    row: Record<string, unknown>,
    mapping: ColumnMapping[],
    dateFormat: string
  ): Partial<CreateLossRecordDTO> {
    const result: Record<string, unknown> = {};

    for (const col of mapping) {
      const value = row[col.source];
      if (value === undefined || value === null || value === '') continue;

      let processed: unknown = value;

      switch (col.type) {
        case 'number':
          processed = parseFloat(String(value).replace(',', '.'));
          if (isNaN(processed as number)) processed = null;
          break;

        case 'currency':
          processed = parseFloat(String(value).replace(/[^0-9,.-]/g, '').replace(',', '.'));
          if (isNaN(processed as number)) processed = null;
          break;

        case 'date':
          processed = this.parseDate(String(value), dateFormat);
          break;

        case 'boolean':
          processed = ['true', '1', 'sim', 'yes', 's', 'y'].includes(String(value).toLowerCase());
          break;

        case 'enum':
          processed = col.options?.find(o =>
            o.toLowerCase() === String(value).toLowerCase()
          ) || String(value).toLowerCase();
          break;

        default:
          processed = String(value).trim();
      }

      result[col.target] = processed;
    }

    return result as Partial<CreateLossRecordDTO>;
  }

  private parseDate(value: string, format: string): Date | null {
    try {
      // Suportar formatos comuns
      const parts = value.split(/[\/\-\.]/);

      if (parts.length !== 3) return null;

      let day: number, month: number, year: number;

      if (format.startsWith('DD')) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
      } else if (format.startsWith('MM')) {
        month = parseInt(parts[0]) - 1;
        day = parseInt(parts[1]);
        year = parseInt(parts[2]);
      } else {
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
      }

      if (year < 100) year += 2000;

      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return null;

      return date;
    } catch {
      return null;
    }
  }

  private validateLossRecord(
    record: Partial<CreateLossRecordDTO>,
    rules: ValidationRule[]
  ): { field: string; message: string; value: unknown }[] {
    const errors: { field: string; message: string; value: unknown }[] = [];

    // Validações padrão
    if (!record.quantity || record.quantity <= 0) {
      errors.push({ field: 'quantity', message: 'Quantidade deve ser positiva', value: record.quantity });
    }

    if (!record.occurrenceDate) {
      errors.push({ field: 'occurrenceDate', message: 'Data de ocorrência é obrigatória', value: record.occurrenceDate });
    }

    if (!record.lossType) {
      errors.push({ field: 'lossType', message: 'Tipo de perda é obrigatório', value: record.lossType });
    }

    // Validações customizadas
    for (const rule of rules) {
      const value = record[rule.field as keyof CreateLossRecordDTO];

      switch (rule.rule) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push({ field: rule.field, message: rule.message, value });
          }
          break;

        case 'positive':
          if (typeof value === 'number' && value <= 0) {
            errors.push({ field: rule.field, message: rule.message, value });
          }
          break;

        case 'digits':
          if (typeof value === 'string' && !/^\d+$/.test(value)) {
            errors.push({ field: rule.field, message: rule.message, value });
          }
          break;
      }
    }

    return errors;
  }

  // ==========================================
  // Loss Records
  // ==========================================

  async getLossRecords(
    orgId: string,
    options?: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
      lossType?: string;
      category?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ records: LossRecord[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from('loss_records')
      .select('*', { count: 'exact' })
      .eq('company_id', orgId)
      .order('occurrence_date', { ascending: false })
      .range(from, to);

    if (options?.storeId) {
      query = query.eq('store_id', options.storeId);
    }

    if (options?.startDate) {
      query = query.gte('occurrence_date', options.startDate.toISOString().split('T')[0]);
    }

    if (options?.endDate) {
      query = query.lte('occurrence_date', options.endDate.toISOString().split('T')[0]);
    }

    if (options?.lossType) {
      query = query.eq('loss_type', options.lossType);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch loss records: ${error.message}`);
    return {
      records: (data || []).map(this.mapLossRecordFromDb),
      total: count || 0,
    };
  }

  async getLossSummary(orgId: string, storeId?: string): Promise<LossSummary[]> {
    let query = supabaseAdmin
      .from('v_loss_summary')
      .select('*')
      .eq('org_id', orgId);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch loss summary: ${error.message}`);
    return (data || []).map(this.mapLossSummaryFromDb);
  }

  async getTopLossProducts(orgId: string, limit = 20): Promise<TopLossProduct[]> {
    const { data, error } = await supabaseAdmin
      .from('v_top_loss_products')
      .select('*')
      .eq('org_id', orgId)
      .limit(limit);

    if (error) throw new Error(`Failed to fetch top loss products: ${error.message}`);
    return (data || []).map(this.mapTopProductFromDb);
  }

  async getTopLossSuppliers(orgId: string, limit = 20): Promise<TopLossSupplier[]> {
    const { data, error } = await supabaseAdmin
      .from('v_top_loss_suppliers')
      .select('*')
      .eq('org_id', orgId)
      .limit(limit);

    if (error) throw new Error(`Failed to fetch top loss suppliers: ${error.message}`);
    return (data || []).map(this.mapTopSupplierFromDb);
  }

  // ==========================================
  // Mappers
  // ==========================================

  private mapTemplateFromDb(data: Record<string, unknown>): ImportTemplate {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      name: data.name as string,
      description: data.description as string | null,
      importType: data.import_type as ImportType,
      columnMapping: data.column_mapping as ColumnMapping[],
      fileFormat: data.file_format as ImportFileFormat,
      hasHeader: data.has_header as boolean,
      headerRow: data.header_row as number,
      dataStartRow: data.data_start_row as number,
      delimiter: data.delimiter as string,
      encoding: data.encoding as string,
      dateFormat: data.date_format as string,
      validationRules: data.validation_rules as ValidationRule[],
      transformations: [],
      isActive: data.is_active as boolean,
      isDefault: data.is_default as boolean,
      usageCount: data.usage_count as number,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : null,
      createdBy: data.created_by as string | null,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapJobFromDb(data: Record<string, unknown>): ImportJob {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      storeId: data.store_id as string | null,
      templateId: data.template_id as string | null,
      fileName: data.file_name as string,
      fileSize: data.file_size as number | null,
      fileFormat: data.file_format as ImportFileFormat,
      fileUrl: data.file_url as string | null,
      importType: data.import_type as ImportType,
      config: data.config as ImportConfig,
      status: data.status as ImportStatus,
      statusMessage: data.status_message as string | null,
      totalRows: data.total_rows as number,
      processedRows: data.processed_rows as number,
      validRows: data.valid_rows as number,
      errorRows: data.error_rows as number,
      skippedRows: data.skipped_rows as number,
      recordsCreated: data.records_created as number,
      recordsUpdated: data.records_updated as number,
      recordsSkipped: data.records_skipped as number,
      totalQuantity: Number(data.total_quantity) || 0,
      totalValue: Number(data.total_value) || 0,
      startedAt: data.started_at ? new Date(data.started_at as string) : null,
      completedAt: data.completed_at ? new Date(data.completed_at as string) : null,
      processingTimeMs: data.processing_time_ms as number | null,
      createdBy: data.created_by as string,
      canRollback: data.can_rollback as boolean,
      rolledBackAt: data.rolled_back_at ? new Date(data.rolled_back_at as string) : null,
      rolledBackBy: data.rolled_back_by as string | null,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
      template: data.template ? this.mapTemplateFromDb(data.template as Record<string, unknown>) : undefined,
    };
  }

  private mapErrorFromDb(data: Record<string, unknown>): ImportJobError {
    return {
      id: data.id as string,
      jobId: data.job_id as string,
      rowNumber: data.row_number as number,
      columnName: data.column_name as string | null,
      fieldName: data.field_name as string | null,
      errorType: data.error_type as ImportJobError['errorType'],
      errorMessage: data.error_message as string,
      errorDetails: data.error_details as Record<string, unknown> | null,
      rawValue: data.raw_value as string | null,
      expectedFormat: data.expected_format as string | null,
      isCritical: data.is_critical as boolean,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapLossRecordFromDb(data: Record<string, unknown>): LossRecord {
    return {
      id: data.id as string,
      orgId: data.org_id as string,
      storeId: data.store_id as string,
      productId: data.product_id as string | null,
      ean: data.ean as string | null,
      sku: data.sku as string | null,
      productName: data.product_name as string | null,
      brand: data.brand as string | null,
      category: data.category as string | null,
      supplier: data.supplier as string | null,
      quantity: Number(data.quantity),
      unitCost: data.unit_cost ? Number(data.unit_cost) : null,
      totalCost: data.total_cost ? Number(data.total_cost) : null,
      salePrice: data.sale_price ? Number(data.sale_price) : null,
      totalSaleValue: data.total_sale_value ? Number(data.total_sale_value) : null,
      marginLost: data.margin_lost ? Number(data.margin_lost) : null,
      lossType: data.loss_type as LossRecord['lossType'],
      lossReason: data.loss_reason as string | null,
      lossCategory: data.loss_category as string | null,
      occurrenceDate: new Date(data.occurrence_date as string),
      expiryDate: data.expiry_date ? new Date(data.expiry_date as string) : null,
      source: data.source as LossRecord['source'],
      importJobId: data.import_job_id as string | null,
      metadata: data.metadata as Record<string, unknown>,
      createdBy: data.created_by as string | null,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapLossSummaryFromDb(data: Record<string, unknown>): LossSummary {
    return {
      orgId: data.org_id as string,
      storeId: data.store_id as string,
      period: new Date(data.period as string),
      lossType: data.loss_type as LossSummary['lossType'],
      category: data.category as string,
      recordCount: Number(data.record_count),
      totalQuantity: Number(data.total_quantity),
      totalCost: Number(data.total_cost),
      totalSaleValue: Number(data.total_sale_value),
      totalMarginLost: Number(data.total_margin_lost),
      productsAffected: Number(data.products_affected),
      suppliersAffected: Number(data.suppliers_affected),
    };
  }

  private mapTopProductFromDb(data: Record<string, unknown>): TopLossProduct {
    return {
      orgId: data.org_id as string,
      productId: data.product_id as string,
      ean: data.ean as string | null,
      productName: data.product_name as string,
      brand: data.brand as string | null,
      category: data.category as string | null,
      occurrenceCount: Number(data.occurrence_count),
      totalQuantity: Number(data.total_quantity),
      totalCost: Number(data.total_cost),
      storesAffected: Number(data.stores_affected),
    };
  }

  private mapTopSupplierFromDb(data: Record<string, unknown>): TopLossSupplier {
    return {
      orgId: data.org_id as string,
      supplier: data.supplier as string,
      occurrenceCount: Number(data.occurrence_count),
      productsAffected: Number(data.products_affected),
      totalQuantity: Number(data.total_quantity),
      totalCost: Number(data.total_cost),
    };
  }
}

// Singleton export
export const importService = new ImportService();
