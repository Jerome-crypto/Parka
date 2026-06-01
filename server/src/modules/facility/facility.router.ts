import { Router } from 'express';
import { 
  createFacility, getFacilities, getFacilityById, updateFacility, 
  deleteFacility, getNearbyFacilities, searchFacilities, getFacilityAvailability 
} from './facility.controller';
import { protect, restrictTo } from '../../middleware/auth';

const router = Router();

// Public routes for drivers discovering parking
router.get('/', getFacilities);
router.get('/nearby', getNearbyFacilities);
router.get('/search', searchFacilities);
router.get('/:id', getFacilityById);
router.get('/:id/availability', getFacilityAvailability);

// Protected routes for operators/admins
router.post('/', protect, restrictTo('OPERATOR', 'ADMIN'), createFacility);
router.put('/:id', protect, restrictTo('OPERATOR', 'ADMIN'), updateFacility);
router.delete('/:id', protect, restrictTo('OPERATOR', 'ADMIN'), deleteFacility);

export default router;
