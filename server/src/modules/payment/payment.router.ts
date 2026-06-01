import { Router } from 'express';
import { initiatePayment, confirmPayment, getPaymentHistory, getReceipt } from './payment.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.post('/initiate', initiatePayment);
router.post('/confirm', confirmPayment);
router.get('/history', getPaymentHistory);

export default router;
