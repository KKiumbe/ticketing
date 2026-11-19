import { z } from 'zod';

const nullableInt = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().min(0).nullable());
const nullableDecimal = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().min(0).max(100).nullable());
const nullableDate = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable());

export const FeeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().positive(),
  perTicket: z.boolean().default(false),
  appliesTo: z.enum(['ALL', 'ONLINE', 'GATE']).default('ALL'),
});

export const EventSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers and dashes').max(60),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  venue: z.string().max(200).nullable().optional(),
  startsAt: z.coerce.date(),
  bannerUrl: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  isPublished: z.boolean().default(true),
  gateMarkupPercent: z.coerce.number().min(0).max(500).default(20),
  fees: z.array(FeeSchema).max(10).default([]),
});
export const UpdateEventSchema = EventSchema.omit({ slug: true }).partial();

export const CategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  price: z.coerce.number().int().min(0),
  capacity: z.coerce.number().int().min(0),
  earlyBirdPrice: nullableInt.optional(),
  earlyBirdDiscountPercent: nullableDecimal.optional(),
  earlyBirdEndsAt: nullableDate.optional(),
  earlyBirdDaysBefore: nullableInt.optional(),
  earlyBirdQuota: nullableInt.optional(),
  allowInstallments: z.boolean().default(false),
  minDeposit: z.coerce.number().int().min(0).default(0),
  installmentDeadline: nullableDate.optional(),
  salesOpen: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
/** Partial update: send null explicitly to clear e.g. early bird */
export const UpdateCategorySchema = CategorySchema.partial();

export const ManualPaymentSchema = z.object({
  amount: z.coerce.number().int().min(0),
  note: z.string().trim().max(200).optional(),
});
export const AssignPaymentSchema = z.object({ ref: z.string().trim().min(3) });
export const HolderNameSchema = z.object({ holderName: z.string().trim().max(80).nullable() });
