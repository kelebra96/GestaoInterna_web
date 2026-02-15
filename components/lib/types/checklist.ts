/**
 * Tipos e Interfaces para Módulo de Checklist
 * Migrado para Supabase - sem dependências Firebase
 */

// Tipos de perguntas suportadas
export type QuestionType =
  | 'yes_no'           // Sim/Não
  | 'multiple_choice'  // Múltipla escolha
  | 'numeric'          // Valor numérico
  | 'text'             // Texto livre
  | 'photo'            // Foto obrigatória
  | 'temperature'      // Temperatura (com min/max)
  | 'signature';       // Assinatura digital

// Tipos de checklist
export type ChecklistType =
  | 'opening'          // Abertura
  | 'closing'          // Fechamento
  | 'haccp'            // HACCP/Segurança Alimentar
  | 'cleaning'         // Limpeza
  | 'merchandising'    // Merchandising
  | 'maintenance'      // Manutenção
  | 'audit'            // Auditoria
  | 'custom';          // Personalizado

// Periodicidade
export type Frequency =
  | 'daily'            // Diário
  | 'weekly'           // Semanal
  | 'monthly'          // Mensal
  | 'per_shift'        // Por turno
  | 'on_demand';       // Sob demanda

// Status de execução
export type ExecutionStatus =
  | 'scheduled'        // Agendado
  | 'in_progress'      // Em andamento
  | 'completed'        // Concluído
  | 'overdue'          // Atrasado
  | 'cancelled';       // Cancelado

// Severidade de não conformidade
export type NonConformitySeverity =
  | 'critical'         // Crítica
  | 'major'            // Maior
  | 'minor';           // Menor

// Pergunta do template
export interface ChecklistQuestion {
  id: string;
  order: number;
  question: string;
  type: QuestionType;
  required: boolean;

  // Opções para múltipla escolha
  options?: string[];

  // Limites para valores numéricos/temperatura
  minValue?: number;
  maxValue?: number;
  unit?: string; // °C, kg, L, etc.

  // Lógica condicional
  conditionalLogic?: {
    showIf: {
      questionId: string;
      value: any;
    };
  };

  // Configurações específicas
  photoRequired?: boolean;
  allowMultiplePhotos?: boolean;
  maxPhotos?: number;

  // Sistema de Pontuação e Conformidade
  points?: number; // Pontos que a pergunta vale (ex: 10 pontos)
  isConformityCheck?: boolean; // Se true, respostas negativas/erros = Não Conforme
  conformityExpectedAnswer?: any; // Resposta esperada para conformidade (ex: "yes" para yes_no)
}

// Template de Checklist
export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  type: ChecklistType;
  frequency: Frequency;

  // Associações
  companyId: string;
  storeIds?: string[];  // Se vazio, aplica a todas as lojas da empresa
  sectors?: string[];   // Setores aplicáveis (padaria, açougue, etc.)
  allowedUserIds?: string[]; // IDs dos usuários com acesso (se vazio, todos têm acesso)

  // Perguntas
  questions: ChecklistQuestion[];

  // Configurações
  estimatedDuration?: number; // Em minutos
  requiresGPS?: boolean;
  requiresSignature?: boolean;
  allowOfflineExecution?: boolean;

  // Controle
  active: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Resposta de uma pergunta
export interface QuestionAnswer {
  questionId: string;

  // Valor da resposta (depende do tipo)
  value?: any;
  booleanValue?: boolean;
  numericValue?: number;
  textValue?: string;
  selectedOptions?: string[];

  // Evidências
  photos?: string[];
  signature?: string;

  // Metadados
  answeredBy: string;
  answeredAt: string;
  notes?: string;

  // Conformidade e Pontuação
  isConform?: boolean; // Se a resposta está conforme o esperado
  pointsAwarded?: number; // Pontos ganhos nesta resposta
}

// Execução de Checklist
export interface ChecklistExecution {
  id: string;

  // Referências
  templateId: string;
  templateName: string;
  templateType: ChecklistType;

  companyId: string;
  storeId: string;
  storeName: string;
  sector?: string;

  // Responsável
  userId: string;
  userName: string;

  // Período
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // Em minutos (copiado do template)

  // Status e progresso
  status: ExecutionStatus;
  progress: number; // 0-100

  // Respostas
  answers: QuestionAnswer[];

  // Pontuação e Conformidade
  score?: {
    totalPoints: number;        // Total de pontos possíveis
    pointsAwarded: number;      // Pontos obtidos
    percentage: number;         // Percentual de pontos (0-100)
  };
  conformity?: {
    totalChecks: number;        // Total de verificações de conformidade
    conformChecks: number;      // Verificações conformes
    nonConformChecks: number;   // Verificações não conformes
    percentage: number;         // Percentual de conformidade (0-100)
  };

  // Localização
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };

  // Assinatura final
  finalSignature?: string;

  // Metadados
  createdAt: string;
  updatedAt: string;

  // Offline
  syncedAt?: string;
  offlineCreated?: boolean;
}

// Não Conformidade
export interface NonConformity {
  id: string;

  // Referências
  executionId: string;
  questionId: string;
  questionText: string;

  companyId: string;
  storeId: string;
  storeName: string;
  sector?: string;

  // Detalhes
  severity: NonConformitySeverity;
  description: string;
  evidence: string[]; // URLs das fotos

  // Responsável
  detectedBy: string;
  detectedAt: string;

  // Status
  status: 'open' | 'in_progress' | 'resolved' | 'overdue';

  // Rastreabilidade
  createdAt: string;
  updatedAt: string;
}

// Plano de Ação
export interface ActionPlan {
  id: string;

  // Referência
  nonConformityId: string;

  // Responsável
  assignedTo: string;
  assignedBy: string;

  // Detalhes
  actions: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';

  // Progresso
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: string;

  // Verificação
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  effectivenessNotes?: string;

  // Histórico
  updates: {
    userId: string;
    userName: string;
    comment: string;
    timestamp: string;
  }[];

  // Escalação
  escalated: boolean;
  escalatedTo?: string;
  escalatedAt?: string;

  createdAt: string;
  updatedAt: string;
}

// Analytics - KPIs
export interface ChecklistKPIs {
  period: {
    start: string;
    end: string;
  };

  // Taxa de conclusão
  completionRate: {
    total: number;
    completed: number;
    overdue: number;
    percentage: number;
  };

  // Não conformidades
  nonConformities: {
    total: number;
    critical: number;
    major: number;
    minor: number;
    resolved: number;
    pending: number;
  };

  // Por loja
  byStore: {
    storeId: string;
    storeName: string;
    completed: number;
    total: number;
    score: number; // 0-100
  }[];

  // Por setor
  bySector: {
    sector: string;
    nonConformities: number;
    resolved: number;
  }[];

  // Tempo médio
  averageResolutionTime: number; // Em horas
}
