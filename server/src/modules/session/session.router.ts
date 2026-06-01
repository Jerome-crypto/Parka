import { Router, Request, Response, NextFunction } from 'express';
import { getSessions } from './session.controller';
import { checkOutDriver } from '../scanner/scanner.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getSessions);

// Route PUT /api/sessions/:id/checkout to the checkout handler
router.put('/:id/checkout', (req: Request, res: Response, next: NextFunction) => {
  // Wrap parameter into body for compatibility with checkOutDriver schema
  req.body.sessionId = req.params.id;
  checkOutDriver(req, res, next);
});

export default router;
