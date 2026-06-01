import { Router } from 'express';
import { register, login, logout, refresh, getMe, forgotPassword, resetPassword } from './auth.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);

export default router;
