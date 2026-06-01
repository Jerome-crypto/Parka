import { Router } from 'express';
import { createReservation, getReservations, getReservationById, cancelReservation } from './reservation.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', createReservation);
router.get('/', getReservations);
router.get('/:id', getReservationById);
router.delete('/:id', cancelReservation);

export default router;
