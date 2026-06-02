import { Router } from 'express';
import {
  changePassword,
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  getProfile,
  savePushSubscription,
  updatePaymentMethod,
  updatePreferences,
  updateProfile,
} from './profile.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', changePassword);
router.put('/preferences', updatePreferences);
router.post('/push-subscriptions', savePushSubscription);

router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', createPaymentMethod);
router.put('/payment-methods/:id', updatePaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);

export default router;
