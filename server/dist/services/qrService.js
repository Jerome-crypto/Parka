"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyQRToken = exports.generateQRToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const generateQRToken = (data) => {
    // Sign QR data with the JWT Secret
    // No expiration or long expiration (e.g. 24 hours relative to arrival time)
    return jsonwebtoken_1.default.sign(data, env_1.env.JWT_SECRET);
};
exports.generateQRToken = generateQRToken;
const verifyQRToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch {
        throw new Error('Invalid or tampered QR code token.');
    }
};
exports.verifyQRToken = verifyQRToken;
