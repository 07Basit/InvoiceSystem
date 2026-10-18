import { Router } from 'express';
import { validate } from '../middleware/validate';
import { declarationProfileSchema } from 'shared';
import {
  createDeclarationProfile,
  deleteDeclarationProfile,
  listDeclarationProfiles,
  setDefaultDeclarationProfile,
  setDeclarationProfileActive,
  updateDeclarationProfile,
} from '../controllers/declaration.controller';

const router = Router();

router.get('/', listDeclarationProfiles);
router.post('/', validate(declarationProfileSchema), createDeclarationProfile);
router.put('/:id', validate(declarationProfileSchema), updateDeclarationProfile);
router.patch('/:id/default', setDefaultDeclarationProfile);
router.patch('/:id/active', setDeclarationProfileActive);
router.delete('/:id', deleteDeclarationProfile);

export default router;
