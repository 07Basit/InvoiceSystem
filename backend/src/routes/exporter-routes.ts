import { Router } from 'express';
import { validate } from '../middleware/validate';
import { exporterProfileSchema } from 'shared';
import {
  createExporterProfile,
  deleteExporterProfile,
  listExporterProfiles,
  setDefaultExporterProfile,
  setExporterProfileActive,
  updateExporterProfile,
} from '../controllers/exporter.controller';

const router = Router();

router.get('/', listExporterProfiles);
router.post('/', validate(exporterProfileSchema), createExporterProfile);
router.put('/:id', validate(exporterProfileSchema), updateExporterProfile);
router.patch('/:id/default', setDefaultExporterProfile);
router.patch('/:id/active', setExporterProfileActive);
router.delete('/:id', deleteExporterProfile);

export default router;
