import { z } from 'zod';

export const AdminLoginSchema = z.object({ password: z.string().min(1, 'Enter the admin password') });
export const ScannerLoginSchema = z.object({
  pin: z.string().min(1, 'Enter the gate PIN'),
  gate: z.string().trim().max(40).optional(),
});
