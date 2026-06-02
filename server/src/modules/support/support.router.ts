import { Router } from 'express';
import { createTicket, getTickets, updateTicketStatus } from './support.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.post('/tickets', createTicket);
router.get('/tickets', getTickets);
router.put('/tickets/:id/status', updateTicketStatus);

export default router;
