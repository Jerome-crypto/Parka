"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const facility_controller_1 = require("./facility.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Public routes for drivers discovering parking
router.get('/', facility_controller_1.getFacilities);
router.get('/nearby', facility_controller_1.getNearbyFacilities);
router.get('/search', facility_controller_1.searchFacilities);
router.get('/:id', facility_controller_1.getFacilityById);
router.get('/:id/availability', facility_controller_1.getFacilityAvailability);
router.get('/:id/reviews', facility_controller_1.getFacilityReviews);
// Protected routes for operators/admins
router.post('/', auth_1.protect, (0, auth_1.restrictTo)('OPERATOR', 'ADMIN'), facility_controller_1.createFacility);
router.post('/:id/reviews', auth_1.protect, (0, auth_1.restrictTo)('DRIVER'), facility_controller_1.upsertFacilityReview);
router.put('/:id', auth_1.protect, (0, auth_1.restrictTo)('OPERATOR', 'ADMIN'), facility_controller_1.updateFacility);
router.delete('/:id', auth_1.protect, (0, auth_1.restrictTo)('OPERATOR', 'ADMIN'), facility_controller_1.deleteFacility);
exports.default = router;
