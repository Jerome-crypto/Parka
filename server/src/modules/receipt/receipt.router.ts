import { Router } from 'express';
import { getReceipt } from '../payment/payment.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/:id', getReceipt);

export default router;
