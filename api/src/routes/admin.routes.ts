import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import { requireRole } from '../middleware/auth.middleware';

const router: Router = Router();
router.use(requireRole('ADMIN'));

router.get('/events', admin.events);
router.post('/events', admin.createEvent);
router.get('/events/:id', admin.event);
router.patch('/events/:id', admin.updateEvent);
router.get('/events/:id/categories', admin.categories);
router.post('/events/:id/categories', admin.createCategory);
router.get('/events/:id/stats', admin.stats);
router.get('/events/:id/orders', admin.orders);
router.get('/events/:id/attendees.csv', admin.attendeesCsv);

router.patch('/categories/:id', admin.updateCategory);

router.get('/orders/:ref', admin.order);
router.post('/orders/:ref/manual-payment', admin.manualPayment);
router.post('/orders/:ref/resend', admin.resend);
router.post('/orders/:ref/cancel', admin.cancel);
router.patch('/tickets/:code', admin.setHolderName);

router.get('/payments/unmatched', admin.unmatchedPayments);
router.post('/payments/:id/assign', admin.assignPayment);
router.post('/mpesa/register-c2b', admin.registerC2B);
export default router;
