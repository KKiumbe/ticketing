import { Router } from 'express';
import * as pub from '../controllers/public.controller';

const router: Router = Router();
router.get('/config', pub.config);
router.get('/events/:slug', pub.event);
router.post('/events/:slug/orders', pub.createOrder);
router.get('/orders/:ref', pub.order);
router.post('/orders/:ref/pay', pub.pay);
router.post('/orders/:ref/check', pub.check);
router.get('/tickets/:code', pub.ticket);
export default router;
