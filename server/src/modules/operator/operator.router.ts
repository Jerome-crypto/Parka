import { Router } from 'express';
import { getOperatorDashboard, getOperatorFacilities, getOperatorReports } from './operator.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

router.use(protect);
router.use(restrictTo('OPERATOR', 'ADMIN'));

router.get('/dashboard', getOperatorDashboard);
router.get('/facilities', getOperatorFacilities);
router.get('/reports', getOperatorReports);

export default router;
