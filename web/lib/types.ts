export type OrderStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type FeeRule = { name: string; type: 'percent' | 'fixed'; value: number; perTicket?: boolean; appliesTo?: 'ALL' | 'ONLINE' | 'GATE' };
export type FeeLine = { name: string; type: FeeRule['type']; value: number; amount: number };

export type PublicCategory = {
  id: number; name: string; description: string | null; price: number; currentPrice: number;
  earlyBirdActive: boolean; earlyBirdPrice: number | null; earlyBirdEndsAt: string | null; earlyBirdLeft: number | null;
  gatePrice: number; remaining: number; soldOut: boolean; salesOpen: boolean;
  installments: boolean; minDeposit: number; installmentDeadline: string | null;
};
export type PublicEvent = {
  id: number; slug: string; name: string; description: string | null; venue: string | null; startsAt: string;
  bannerUrl: string | null; gateMarkupPercent: number; salesClosed: boolean; fees: FeeRule[];
};

export type OrderView = {
  ref: string; status: OrderStatus; plan: 'FULL' | 'INSTALLMENT'; buyerName: string; phoneMasked: string;
  event: { name: string; slug: string; startsAt: string; venue: string | null };
  category: string; quantity: number; unitPrice: number; earlyBird: boolean;
  subtotal: number; fees: FeeLine[]; feesAmount: number; channel: 'ONLINE' | 'GATE';
  total: number; paid: number; balance: number; paybill: string | null; simulate: boolean;
  payments: { id: string | null; channel: string; amount: number; status: string; receipt: string | null; resultDesc: string | null; createdAt: string }[];
  tickets: { code: string; seq: number; status: string; holderName: string | null; url: string }[];
};

export type TicketView = {
  code: string; seq: number; of: number; status: 'VALID' | 'CHECKED_IN' | 'VOID'; holderName: string;
  checkedInAt: string | null; ref: string; category: string;
  event: { name: string; startsAt: string; venue: string | null }; qr: string;
};

export type AdminEvent = PublicEvent & { isPublished: boolean; createdAt: string };
export type AdminCategory = {
  id: number; eventId: number; name: string; description: string | null; price: number; capacity: number;
  earlyBirdPrice: number | null; earlyBirdDiscountPercent: number | null; earlyBirdEndsAt: string | null;
  earlyBirdDaysBefore: number | null; earlyBirdQuota: number | null; allowInstallments: boolean; minDeposit: number;
  installmentDeadline: string | null; salesOpen: boolean; sortOrder: number;
  state: { sold: number; remaining: number; earlyBirdActive: boolean; earlyBirdLeft: number | null; earlyBirdEndsAt: string | null; currentPrice: number; gatePrice: number; installmentsOpen: boolean };
};
export type AdminOrderRow = {
  id: number; ref: string; buyerName: string; phone: string; email: string | null; quantity: number; unitPrice: number;
  totalAmount: number; amountPaid: number; isEarlyBird: boolean; paymentPlan: string; status: OrderStatus;
  saleChannel: string; soldBy: string | null; createdAt: string; paidAt: string | null; category: { name: string };
};
export type AdminOrder = AdminOrderRow & {
  subtotal: number | null; feesAmount: number; feeBreakdown: FeeLine[];
  event: AdminEvent; category: AdminCategory;
  payments: { id: number; channel: string; amount: number; phone: string | null; mpesaReceipt: string | null; status: string; resultDesc: string | null; createdAt: string; accountRef: string | null }[];
  tickets: { id: number; code: string; seq: number; holderName: string | null; status: string; checkedInAt: string | null; checkedInBy: string | null; url: string }[];
};
export type Stats = {
  categories: ({ id: number; name: string; capacity: number; price: number } & Record<string, number>)[];
  totals: Record<string, number>;
  unmatchedPayments: { count: number; amount: number };
};
