import { Router } from 'express';
import * as scan from '../controllers/scan.controller';
import { requireRole } from '../middleware/auth.middleware';

const router: Router = Router();
router.use(requireRole('SCANNER'));
router.get('/events', scan.events);
router.post('/validate', scan.validate);
router.get('/events/:id/gate-prices', scan.gatePrices);
router.post('/sell', scan.sell);
export default router;
