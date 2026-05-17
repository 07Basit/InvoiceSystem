import { Router } from 'express';
import { validate } from '../middleware/validate';
import { exporterProfileSchema } from 'shared';
import { getExporterProfile, upsertExporterProfile } from '../controllers/exporter.controller';

const router = Router();

router.get('/', getExporterProfile);
router.put('/', validate(exporterProfileSchema), upsertExporterProfile);

export default router;
