import './load-env';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from './lib/env';
import { AppError } from './lib/errors';
import adminRouter from './routes/admin.routes';
import authRouter from './routes/auth.routes';
import paymentRouter from './routes/payment.routes';
import publicRouter from './routes/public.routes';
import scanRouter from './routes/scan.routes';

const app: Express = express();
app.set('trust proxy', 1);
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
app.use(express.json({ limit: '200kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, simulate: env.mpesa.simulate }));

app.use('/api/v1/pay', paymentRouter); // Safaricom callbacks
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/scan', scanRouter); // gate app (SCANNER)
app.use('/api/v1/admin', adminRouter); // admin web (ADMIN)
app.use('/api/v1', publicRouter); // buyers

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: err.errors[0]?.message ?? 'Validation error', errors: err.errors });
  }
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err instanceof SyntaxError) return res.status(400).json({ message: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
});

export default app;
