/**
 * Event Types - Sprint 6 Event-Driven Architecture
 *
 * Definição de todos os tipos de eventos do sistema.
 * Cada evento tem um tipo único e payload tipado.
 */

// ==========================================
// Base Types
// ==========================================

export interface BaseEvent {
  /** ID único do evento */
  id: string;
  /** Tipo do evento */
  type: string;
  /** Timestamp de criação */
  timestamp: string;
  /** ID de correlação para tracing */
  correlationId?: string;
  /** ID do usuário que gerou o evento */
  userId?: string;
  /** ID da organização */
  orgId?: string;
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}

export interface DomainEvent<T extends string, P> extends BaseEvent {
  type: T;
  payload: P;
}

// ==========================================
// Solicitação Events
// ==========================================

export type SolicitacaoCreatedEvent = DomainEvent<
  'solicitacao.created',
  {
    solicitacaoId: string;
    storeId: string;
    status: string;
    itemCount: number;
    totalValue?: number;
  }
>;

export type SolicitacaoUpdatedEvent = DomainEvent<
  'solicitacao.updated',
  {
    solicitacaoId: string;
    changes: Record<string, { from: any; to: any }>;
  }
>;

export type SolicitacaoStatusChangedEvent = DomainEvent<
  'solicitacao.status_changed',
  {
    solicitacaoId: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
  }
>;

export type SolicitacaoDeletedEvent = DomainEvent<
  'solicitacao.deleted',
  {
    solicitacaoId: string;
    reason?: string;
  }
>;

export type SolicitacaoItemAddedEvent = DomainEvent<
  'solicitacao.item_added',
  {
    solicitacaoId: string;
    itemId: string;
    ean?: string;
    quantity: number;
    unitPrice?: number;
  }
>;

export type SolicitacaoItemRemovedEvent = DomainEvent<
  'solicitacao.item_removed',
  {
    solicitacaoId: string;
    itemId: string;
    ean?: string;
  }
>;

// ==========================================
// Product Events
// ==========================================

export type ProductCreatedEvent = DomainEvent<
  'product.created',
  {
    productId: string;
    ean?: string;
    name: string;
    category?: string;
  }
>;

export type ProductUpdatedEvent = DomainEvent<
  'product.updated',
  {
    productId: string;
    ean?: string;
    changes: Record<string, { from: any; to: any }>;
  }
>;

export type ProductDeletedEvent = DomainEvent<
  'product.deleted',
  {
    productId: string;
    ean?: string;
  }
>;

export type ProductPriceChangedEvent = DomainEvent<
  'product.price_changed',
  {
    productId: string;
    ean?: string;
    oldPrice: number;
    newPrice: number;
    percentChange: number;
  }
>;

// ==========================================
// Inventory Events
// ==========================================

export type InventoryCreatedEvent = DomainEvent<
  'inventory.created',
  {
    inventoryId: string;
    storeId: string;
    type?: string;
  }
>;

export type InventoryCompletedEvent = DomainEvent<
  'inventory.completed',
  {
    inventoryId: string;
    storeId: string;
    itemCount: number;
    discrepancyCount: number;
  }
>;

export type InventoryItemCountedEvent = DomainEvent<
  'inventory.item_counted',
  {
    inventoryId: string;
    ean: string;
    expectedQuantity: number;
    countedQuantity: number;
    difference: number;
  }
>;

// ==========================================
// User Events
// ==========================================

export type UserCreatedEvent = DomainEvent<
  'user.created',
  {
    userId: string;
    email: string;
    role: string;
    storeId?: string;
  }
>;

export type UserUpdatedEvent = DomainEvent<
  'user.updated',
  {
    userId: string;
    changes: Record<string, { from: any; to: any }>;
  }
>;

export type UserLoginEvent = DomainEvent<
  'user.login',
  {
    userId: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }
>;

export type UserLogoutEvent = DomainEvent<
  'user.logout',
  {
    userId: string;
  }
>;

// ==========================================
// Store Events
// ==========================================

export type StoreCreatedEvent = DomainEvent<
  'store.created',
  {
    storeId: string;
    name: string;
  }
>;

export type StoreUpdatedEvent = DomainEvent<
  'store.updated',
  {
    storeId: string;
    changes: Record<string, { from: any; to: any }>;
  }
>;

// ==========================================
// Notification Events
// ==========================================

export type NotificationSentEvent = DomainEvent<
  'notification.sent',
  {
    notificationId: string;
    userId: string;
    type: string;
    channel: 'push' | 'email' | 'sms' | 'in_app';
    success: boolean;
  }
>;

// ==========================================
// System Events
// ==========================================

export type SystemHealthCheckEvent = DomainEvent<
  'system.health_check',
  {
    services: Record<string, { healthy: boolean; latencyMs?: number }>;
  }
>;

export type SystemErrorEvent = DomainEvent<
  'system.error',
  {
    error: string;
    stack?: string;
    context?: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }
>;

// ==========================================
// Webhook Events
// ==========================================

export type WebhookDeliveredEvent = DomainEvent<
  'webhook.delivered',
  {
    webhookId: string;
    endpointUrl: string;
    eventType: string;
    statusCode: number;
    success: boolean;
    retryCount: number;
  }
>;

export type WebhookFailedEvent = DomainEvent<
  'webhook.failed',
  {
    webhookId: string;
    endpointUrl: string;
    eventType: string;
    error: string;
    retryCount: number;
    willRetry: boolean;
  }
>;

// ==========================================
// Union Type of All Events
// ==========================================

export type AppEvent =
  // Solicitação
  | SolicitacaoCreatedEvent
  | SolicitacaoUpdatedEvent
  | SolicitacaoStatusChangedEvent
  | SolicitacaoDeletedEvent
  | SolicitacaoItemAddedEvent
  | SolicitacaoItemRemovedEvent
  // Product
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | ProductPriceChangedEvent
  // Inventory
  | InventoryCreatedEvent
  | InventoryCompletedEvent
  | InventoryItemCountedEvent
  // User
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserLoginEvent
  | UserLogoutEvent
  // Store
  | StoreCreatedEvent
  | StoreUpdatedEvent
  // Notification
  | NotificationSentEvent
  // System
  | SystemHealthCheckEvent
  | SystemErrorEvent
  // Webhook
  | WebhookDeliveredEvent
  | WebhookFailedEvent;

// ==========================================
// Event Type Helpers
// ==========================================

export type EventType = AppEvent['type'];

export type EventPayload<T extends EventType> = Extract<AppEvent, { type: T }>['payload'];

export type EventHandler<T extends EventType> = (
  event: Extract<AppEvent, { type: T }>
) => Promise<void> | void;

// ==========================================
// Event Categories
// ==========================================

export const EVENT_CATEGORIES = {
  solicitacao: [
    'solicitacao.created',
    'solicitacao.updated',
    'solicitacao.status_changed',
    'solicitacao.deleted',
    'solicitacao.item_added',
    'solicitacao.item_removed',
  ],
  product: [
    'product.created',
    'product.updated',
    'product.deleted',
    'product.price_changed',
  ],
  inventory: [
    'inventory.created',
    'inventory.completed',
    'inventory.item_counted',
  ],
  user: [
    'user.created',
    'user.updated',
    'user.login',
    'user.logout',
  ],
  store: [
    'store.created',
    'store.updated',
  ],
  notification: [
    'notification.sent',
  ],
  system: [
    'system.health_check',
    'system.error',
  ],
  webhook: [
    'webhook.delivered',
    'webhook.failed',
  ],
} as const;

export type EventCategory = keyof typeof EVENT_CATEGORIES;
