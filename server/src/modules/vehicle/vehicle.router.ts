import { Router } from 'express';
import { createVehicle, getVehicles, updateVehicle, deleteVehicle } from './vehicle.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

// Only DRIVER role can manage their vehicles
router.use(protect);
router.use(restrictTo('DRIVER', 'ADMIN'));

router.post('/', createVehicle);
router.get('/', getVehicles);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
