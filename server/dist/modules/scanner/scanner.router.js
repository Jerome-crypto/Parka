"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scanner_controller_1 = require("./scanner.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Attendants and Admins validate scans and check in/out
router.use(auth_1.protect);
router.use((0, auth_1.restrictTo)('ATTENDANT', 'ADMIN'));
router.post('/validate', scanner_controller_1.validateQR);
router.post('/checkin', scanner_controller_1.checkInDriver);
router.post('/checkout', scanner_controller_1.checkOutDriver);
exports.default = router;
