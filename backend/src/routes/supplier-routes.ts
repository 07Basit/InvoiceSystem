import { Router } from 'express';
import { validate } from '../middleware/validate';
import { supplierSchema } from 'shared';
import { createSupplier, deleteSupplier, listSuppliers, setSupplierActive, updateSupplier } from '../controllers/supplier.controller';

const router = Router();

router.get('/', listSuppliers);
router.post('/', validate(supplierSchema), createSupplier);
router.put('/:id', validate(supplierSchema), updateSupplier);
router.patch('/:id/active', setSupplierActive);
router.delete('/:id', deleteSupplier);

export default router;
