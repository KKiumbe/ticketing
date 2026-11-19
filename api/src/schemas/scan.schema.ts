import { z } from 'zod';

export const ValidateTicketSchema = z.object({
  code: z.string().min(1, 'No ticket code').max(300),
  eventId: z.coerce.number().int().positive().optional(),
});

export const GateSaleSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  buyerName: z.string().trim().max(80).optional(),
  phone: z.string().optional(),
  method: z.enum(['MPESA', 'CASH']).default('MPESA'),
});
