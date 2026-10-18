import { Router } from 'express';
import { validate } from '../middleware/validate';
import { productSchema } from 'shared';
import { createProduct, deleteProduct, listProducts, setProductActive, updateProduct } from '../controllers/product.controller';

const router = Router();

router.get('/', listProducts);
router.post('/', validate(productSchema), createProduct);
router.put('/:id', validate(productSchema), updateProduct);
router.patch('/:id/active', setProductActive);
router.delete('/:id', deleteProduct);

export default router;
