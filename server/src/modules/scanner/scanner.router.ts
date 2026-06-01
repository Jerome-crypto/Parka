import { Router } from 'express';
import { validateQR, checkInDriver, checkOutDriver } from './scanner.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

// Attendants and Admins validate scans and check in/out
router.use(protect);
router.use(restrictTo('ATTENDANT', 'ADMIN'));

router.post('/validate', validateQR);
router.post('/checkin', checkInDriver);
router.post('/checkout', checkOutDriver);

export default router;
