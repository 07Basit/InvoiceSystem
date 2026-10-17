import { Router } from 'express';
import { validate } from '../middleware/validate';
import { bankProfileSchema } from 'shared';
import {
  createBankProfile,
  deleteBankProfile,
  listBankProfiles,
  setDefaultBankProfile,
  setBankProfileActive,
  updateBankProfile,
} from '../controllers/bank.controller';

const router = Router();

router.get('/', listBankProfiles);
router.post('/', validate(bankProfileSchema), createBankProfile);
router.put('/:id', validate(bankProfileSchema), updateBankProfile);
router.patch('/:id/default', setDefaultBankProfile);
router.patch('/:id/active', setBankProfileActive);
router.delete('/:id', deleteBankProfile);

export default router;
