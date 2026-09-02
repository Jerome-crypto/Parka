"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehicle_controller_1 = require("./vehicle.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Only DRIVER role can manage their vehicles
router.use(auth_1.protect);
router.use((0, auth_1.restrictTo)('DRIVER', 'ADMIN'));
router.post('/', vehicle_controller_1.createVehicle);
router.get('/', vehicle_controller_1.getVehicles);
router.put('/:id', vehicle_controller_1.updateVehicle);
router.delete('/:id', vehicle_controller_1.deleteVehicle);
exports.default = router;
