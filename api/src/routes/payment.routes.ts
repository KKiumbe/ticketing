// Public Safaricom callbacks. The path avoids the word "mpesa" (Safaricom rejects such URLs).
import { Router } from 'express';
import * as pay from '../controllers/payment.controller';

const router: Router = Router();
router.post('/stk-callback/:secret', pay.checkSecret, pay.stkCallback);
router.post('/c2b/validate/:secret', pay.checkSecret, pay.c2bValidate);
router.post('/c2b/confirm/:secret', pay.checkSecret, pay.c2bConfirm);
router.post('/simulate/:checkoutId', pay.simulate);
export default router;
