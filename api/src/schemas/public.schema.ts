import { z } from 'zod';
import { normalizePhone } from '../lib/util';

export const mpesaPhone = z
  .string({ required_error: 'Enter your M-Pesa number' })
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid Safaricom number, e.g. 0712345678' });
    return p ?? '';
  });

const optionalAmount = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional());

export const CreateOrderSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  buyerName: z.string().trim().min(2, 'Enter your name').max(80),
  phone: mpesaPhone,
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().email('Enter a valid email').max(120).optional()),
  quantity: z.coerce.number().int().min(1, 'Quantity must be 1–20').max(20, 'Quantity must be 1–20').default(1),
  plan: z.enum(['FULL', 'INSTALLMENT']).default('FULL'),
  amount: optionalAmount,
});
export type CreateOrderBody = z.infer<typeof CreateOrderSchema>;

export const PayOrderSchema = z.object({
  amount: optionalAmount,
  phone: z.string().optional(),
});
