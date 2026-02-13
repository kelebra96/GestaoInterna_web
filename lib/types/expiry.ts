export type ExpiryReportStatus =
  | 'active'
  | 'resolved'
  | 'expired'
  | 'reported'
  | 'watching'
  | 'confirmed'
  | 'ignored'
  | 'canceled';

export interface ExpiryReport {
  id: string;
  barcode: string;
  productName: string;
  expiryDate: string;
  quantity: number;
  photoUrl?: string | null;
  storeId: string;
  companyId?: string | null;
  createdBy: string;
  status: ExpiryReportStatus | string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  location?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ExpiryReportWithDays extends ExpiryReport {
  daysToExpire: number;
}

export interface ExpiryStats {
  total: number;
  d0Count: number;
  d1Count: number;
  d3Count: number;
  d7Count: number;
  resolvedCount: number;
  expiredCount: number;
}

export type ExpiryDaysFilter = number;
