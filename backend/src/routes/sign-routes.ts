import { Router } from 'express';
import { validate } from '../middleware/validate';
import { signProfileSchema } from 'shared';
import {
  createSignProfile,
  deleteSignProfile,
  listSignProfiles,
  setDefaultSignProfile,
  setSignProfileActive,
  updateSignProfile,
} from '../controllers/sign.controller';

const router = Router();

router.get('/', listSignProfiles);
router.post('/', validate(signProfileSchema), createSignProfile);
router.put('/:id', validate(signProfileSchema), updateSignProfile);
router.patch('/:id/default', setDefaultSignProfile);
router.patch('/:id/active', setSignProfileActive);
router.delete('/:id', deleteSignProfile);

export default router;
