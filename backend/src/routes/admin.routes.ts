import { Router } from 'express';
import * as AdminController from '../controllers/admin.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { listUsersSchema, setUserActiveSchema } from '../validators/admin.validator';

const router = Router();

// Every route below requires a valid access token AND role === 'admin'.
// This is the concrete surface for "Role-based authorization checks" -
// requireAdmin previously existed in auth.middleware.ts but had no route
// actually using it.
router.use(requireAuth, requireAdmin);

router.get('/users', validate(listUsersSchema), AdminController.listUsers);
router.patch(
  '/users/:id/status',
  validate(setUserActiveSchema),
  AdminController.setUserActive
);

export default router;
