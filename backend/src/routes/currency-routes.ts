import { Router } from 'express';
import { validate } from '../middleware/validate';
import { currencySettingsSchema } from 'shared';
import { getCurrencySettings, updateCurrencySettings } from '../controllers/currency.controller';

const router = Router();

router.get('/', getCurrencySettings);
router.put('/', validate(currencySettingsSchema), updateCurrencySettings);

export default router;
