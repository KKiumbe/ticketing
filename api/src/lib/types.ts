export type OrderStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type PaymentPlan = 'FULL' | 'INSTALLMENT';
export type SaleChannel = 'ONLINE' | 'GATE';
export type PaymentChannel = 'STK' | 'C2B' | 'MANUAL';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'VOID';
export type ScanResult = 'OK' | 'ALREADY_USED' | 'INVALID' | 'VOID' | 'WRONG_EVENT';
export type Role = 'ADMIN' | 'SCANNER';

/** Orders that hold seats */
export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'PARTIAL', 'PAID'];

export type FeeRule = {
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  perTicket?: boolean;
  appliesTo?: 'ALL' | 'ONLINE' | 'GATE';
};
export type FeeLine = { name: string; type: FeeRule['type']; value: number; amount: number };
