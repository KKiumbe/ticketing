import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { requireRole } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router: Router = Router();
const limit = rateLimit({ windowMs: 15 * 60_000, max: 10 });
router.post('/admin/login', limit, auth.adminLogin);
router.post('/scanner/login', limit, auth.scannerLogin);
router.get('/me', requireRole('SCANNER'), auth.me);
export default router;
