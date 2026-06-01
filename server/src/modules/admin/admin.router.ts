import { Router } from 'express';
import { getUsers, toggleUserStatus, getPendingFacilities, approveFacility, getSystemMetrics, getAuditLogs } from './admin.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

router.use(protect);
router.use(restrictTo('ADMIN'));

router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);
router.get('/facilities', getPendingFacilities);
router.put('/facilities/:id/approve', approveFacility);
router.get('/system', getSystemMetrics);
router.get('/audit', getAuditLogs);

export default router;
