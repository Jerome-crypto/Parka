import { Router } from 'express';
import {
  createPricingRule,
  createSpace,
  createZone,
  deletePricingRule,
  getFacilityLayout,
  getOperatorDashboard,
  getOperatorFacilities,
  getOperatorReports,
  getPricingRules,
  updatePricingRule,
} from './operator.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

router.use(protect);
router.use(restrictTo('OPERATOR', 'ADMIN'));

router.get('/dashboard', getOperatorDashboard);
router.get('/facilities', getOperatorFacilities);
router.get('/reports', getOperatorReports);
router.get('/pricing-rules', getPricingRules);
router.post('/pricing-rules', createPricingRule);
router.put('/pricing-rules/:id', updatePricingRule);
router.delete('/pricing-rules/:id', deletePricingRule);
router.get('/facilities/:facilityId/layout', getFacilityLayout);
router.post('/zones', createZone);
router.post('/spaces', createSpace);

export default router;
