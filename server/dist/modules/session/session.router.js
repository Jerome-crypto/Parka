"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_controller_1 = require("./session.controller");
const scanner_controller_1 = require("../scanner/scanner.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/', session_controller_1.getSessions);
// Route PUT /api/sessions/:id/checkout to the checkout handler
router.put('/:id/checkout', (req, res, next) => {
    // Wrap parameter into body for compatibility with checkOutDriver schema
    req.body.sessionId = req.params.id;
    (0, scanner_controller_1.checkOutDriver)(req, res, next);
});
exports.default = router;
