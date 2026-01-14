/**
 * Tipos e Interfaces para Módulo de Inventário
 * MyInventory - Sistema de Gestão de Inventário
 * Migrado para Supabase - sem dependências Firebase
 */

import { z } from 'zod';

// ============================================
// ENUMS E STATUS
// ============================================

export type InventoryStatus = 'preparation' | 'in_progress' | 'completed' | 'cancelled';
export type AddressStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';
export type CountStatus = 'pending' | 'counted' | 'discrepancy';
export type DiffType = 'ok' | 'excess' | 'shortage';

export const INVENTORY_STATUS: Record<InventoryStatus, { name: string; color: string }> = {
  preparation: { name: 'Preparação', color: 'gray' },
  in_progress: { name: 'Em Andamento', color: 'blue' },
  completed: { name: 'Concluído', color: 'green' },
  cancelled: { name: 'Cancelado', color: 'red' },
};

export const ADDRESS_STATUS: Record<AddressStatus, { name: string; color: string }> = {
  pending: { name: 'Pendente', color: 'gray' },
  assigned: { name: 'Atribuído', color: 'yellow' },
  in_progress: { name: 'Em Contagem', color: 'blue' },
  completed: { name: 'Concluído', color: 'green' },
};

export const DIFF_TYPE: Record<DiffType, { name: string; color: string }> = {
  ok: { name: 'OK', color: 'green' },
  excess: { name: 'Excesso', color: 'orange' },
  shortage: { name: 'Falta', color: 'red' },
};

// ============================================
// INTERFACES FIRESTORE
// ============================================

/**
 * Inventário - Representa um ciclo de inventário em uma loja
 */
export interface Inventory {
  id: string;
  storeId: string;
  companyId: string;
  name: string;
  status: InventoryStatus;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  startedAt?: string | Date;
  completedAt?: string | Date;

  // Métricas agregadas
  totalAddresses: number;
  addressesCompleted: number;
  totalItemsExpected: number;
  totalItemsCounted: number;
  totalDiscrepancies: number;

  // Informações de importação
  importedFileName?: string;
  importedAt?: string | Date;
  importedBy?: string;
}

/**
 * InventoryAddress - Endereço/lote para contagem
 */
export interface InventoryAddress {
  id: string;
  inventoryId: string;
  storeId: string;
  companyId: string;
  addressCode: string; // Ex: "A1-01-01"
  status: AddressStatus;

  // Atribuição
  assignedUserId?: string;
  assignedUserName?: string;
  assignedAt?: string | Date;

  // Progresso
  itemsCounted: number;
  totalItems: number;
  startedAt?: string | Date;
  completedAt?: string | Date;
  completedBy?: string;

  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * InventoryItem - Produto esperado no inventário
 */
export interface InventoryItem {
  id: string;
  inventoryId: string;
  storeId: string;
  companyId: string;
  addressId?: string; // Opcional: pode estar associado a um endereço

  // Dados do arquivo TXT
  ean: string;
  internalCode: string;
  description: string;
  price: number; // Em centavos
  expectedQuantity: number;

  // Produto relacionado
  productId?: string;
  autoCreated: boolean; // Produto foi auto-criado durante importação?

  // Contagem
  countedQuantity: number;
  countStatus: CountStatus;

  // Datas de validade (opcional)
  expirationDates?: Array<{
    date: string; // YYYY-MM-DD
    quantity: number;
  }>;

  // Divergência
  diffQuantity: number; // countedQuantity - expectedQuantity
  diffValue: number; // diffQuantity * price (em centavos)
  diffType: DiffType;

  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * InventoryCount - Registro de contagem individual (audit trail)
 */
export interface InventoryCount {
  id: string;
  inventoryId: string;
  inventoryItemId: string;
  addressId?: string;
  storeId: string;
  companyId: string;

  // Dados da contagem (cache)
  ean: string;
  productDescription: string;
  quantity: number;
  expirationDate?: string; // YYYY-MM-DD (opcional)

  // Quem contou
  countedBy: string;
  countedByName: string;
  countedAt: string | Date;
  addressCode?: string;

  createdAt: string | Date;
}

// ============================================
// SCHEMAS ZOD PARA VALIDAÇÃO
// ============================================

/**
 * Schema para criar inventário
 */
export const InventoryCreateSchema = z.object({
  name: z.string().min(3, 'Nome do inventário deve ter pelo menos 3 caracteres'),
  storeId: z.string().min(1, 'Loja é obrigatória'),
});

/**
 * Schema para atualizar inventário
 */
export const InventoryUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  status: z.enum(['preparation', 'in_progress', 'completed', 'cancelled']).optional(),
});

/**
 * Schema para linha do arquivo TXT posicional
 */
export const TxtLineSchema = z.object({
  ean: z.string().length(13, 'EAN deve ter 13 dígitos'),
  internalCode: z.string().max(10, 'Código interno deve ter no máximo 10 caracteres'),
  description: z.string().max(50, 'Descrição deve ter no máximo 50 caracteres'),
  price: z.number().min(0, 'Preço deve ser maior ou igual a 0'),
  expectedQuantity: z.number().int().min(0, 'Quantidade esperada deve ser maior ou igual a 0'),
});

/**
 * Schema para importação de TXT
 */
export const ImportTxtSchema = z.object({
  textContent: z.string().min(1, 'Conteúdo do arquivo é obrigatório'),
  fileName: z.string().optional(),
});

/**
 * Schema para criar endereço
 */
export const AddressCreateSchema = z.object({
  addressCode: z.string()
    .min(1, 'Código do endereço é obrigatório')
    .regex(/^[A-Z0-9.]+$/, 'Formato inválido. Use apenas letras, números e pontos'),
});

/**
 * Schema para atribuir endereço
 */
export const AddressAssignSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  userName: z.string().min(1, 'Nome do usuário é obrigatório'),
});

/**
 * Schema para submeter contagem
 */
export const CountSubmitSchema = z.object({
  ean: z.string().length(13, 'EAN deve ter 13 dígitos'),
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que 0'),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  addressCode: z.string().min(1, 'Código do endereço é obrigatório'),
});

/**
 * Schema para check-in em endereço
 */
export const AddressCheckinSchema = z.object({
  addressCode: z.string().min(1, 'Código do endereço é obrigatório'),
});

// ============================================
// TIPOS AUXILIARES
// ============================================

/**
 * Dados parseados de uma linha do TXT
 */
export interface TxtLineData {
  ean: string;
  internalCode: string;
  description: string;
  price: number;
  expectedQuantity: number;
  lineNumber: number; // Para rastreamento de erros
  rawLine: string; // Linha original para debug
}

/**
 * Resultado do parsing do TXT
 */
export interface TxtParseResult {
  success: boolean;
  lines: TxtLineData[];
  errors: TxtParseError[];
  totalLines: number;
  validLines: number;
}

/**
 * Erro no parsing do TXT
 */
export interface TxtParseError {
  lineNumber: number;
  error: string;
  rawLine: string;
}

/**
 * Item para exportação no TXT final
 */
export interface ExportItem {
  ean: string;
  internalCode: string;
  description: string;
  price: number;
  quantity: number; // Quantidade contada (ou esperada se não contada)
}

/**
 * Métricas do dashboard
 */
export interface InventoryDashboardMetrics {
  // Progresso geral
  totalAddresses: number;
  addressesCompleted: number;
  addressesInProgress: number;
  addressesPending: number;
  progressPercentage: number;

  // Items
  totalItems: number;
  itemsCounted: number;
  itemsPending: number;
  itemsWithDiscrepancy: number;

  // Divergências
  totalExcess: number;
  totalShortage: number;
  totalOk: number;
  totalDiscrepancyValue: number; // Em centavos

  // Produtividade
  topCounters: Array<{
    userId: string;
    userName: string;
    itemsCounted: number;
    addressesCompleted: number;
  }>;

  // Atividade recente
  recentCounts: Array<{
    userName: string;
    productDescription: string;
    quantity: number;
    countedAt: Date;
  }>;
}

// ============================================
// MENSAGENS DE ERRO
// ============================================

export const INVENTORY_ERROR_MESSAGES = {
  // Inventário
  INVENTORY_NOT_FOUND: 'Inventário não encontrado',
  INVENTORY_ALREADY_ACTIVE: 'Já existe um inventário ativo para esta loja',
  INVENTORY_CANNOT_DELETE: 'Não é possível deletar inventário que não está em preparação',
  INVENTORY_CANNOT_EDIT: 'Não é possível editar inventário concluído ou cancelado',
  INVENTORY_NAME_REQUIRED: 'Nome do inventário é obrigatório',
  INVENTORY_STORE_REQUIRED: 'Loja é obrigatória',

  // Endereços
  ADDRESS_NOT_FOUND: 'Endereço não encontrado',
  ADDRESS_ALREADY_ASSIGNED: 'Endereço já está atribuído a outro usuário',
  ADDRESS_INVALID_FORMAT: 'Formato de endereço inválido. Use o padrão: A1-01-01',
  ADDRESS_USER_HAS_ACTIVE: 'Usuário já possui um endereço ativo',
  ADDRESS_CANNOT_ASSIGN: 'Não é possível atribuir endereço que não está pendente',

  // Items
  ITEM_NOT_FOUND: 'Item não encontrado no inventário',
  ITEM_ALREADY_COUNTED: 'Item já foi contado',

  // Importação
  IMPORT_EMPTY_FILE: 'Arquivo vazio',
  IMPORT_INVALID_FORMAT: 'Formato de arquivo inválido',
  IMPORT_NO_VALID_LINES: 'Nenhuma linha válida encontrada no arquivo',

  // Contagem
  COUNT_NO_ADDRESS_ASSIGNED: 'Usuário não possui endereço atribuído',
  COUNT_INVALID_EAN: 'EAN inválido',
  COUNT_INVALID_QUANTITY: 'Quantidade inválida',

  // Permissões
  PERMISSION_DENIED: 'Você não tem permissão para esta ação',
};
