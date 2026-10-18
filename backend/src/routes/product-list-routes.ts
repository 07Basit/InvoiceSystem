import { Router } from 'express';
import { validate } from '../middleware/validate';
import { productListSchema } from 'shared';
import { createProductList, deleteProductList, listProductLists } from '../controllers/product-list.controller';

const router = Router();

router.get('/', listProductLists);
router.post('/', validate(productListSchema), createProductList);
router.delete('/:id', deleteProductList);

export default router;
