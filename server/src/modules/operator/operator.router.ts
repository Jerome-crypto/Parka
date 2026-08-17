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
  getOperatorAttendants,
  createOperatorAttendant,
  deleteOperatorAttendant,
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

// Attendants management for Operator
router.get('/attendants', getOperatorAttendants);
router.post('/attendants', createOperatorAttendant);
router.delete('/attendants/:id', deleteOperatorAttendant);

export default router;

