import { Router } from 'express';
import { getNotifications, markNotificationRead } from './notification.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/:id/read', markNotificationRead);

export default router;
