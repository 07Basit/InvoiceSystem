import { Router } from 'express';
import invoiceRouter from './invoice-routes';
import importerRouter from './importer-routes';
import exporterRouter from './exporter-routes';
import bankRouter from './bank-routes';
import signRouter from './sign-routes';
import productRouter from './product-routes';
import documentRouter from './document-routes';
import dashboardRouter from './dashboard-routes';
import currencyRouter from './currency-routes';
import notificationRouter from './notification-routes';
import recycleRouter from './recycle-routes';
import draftRouter from './draft-routes';
import authRouter from './auth-routes';
import { requireAuth, requireCsrfHeader } from '../middleware/auth';

export const apiRouter = Router();

// Public: login. Everything registered after requireAuth needs a valid bearer token.
apiRouter.use(requireCsrfHeader);
apiRouter.use('/auth', authRouter);
apiRouter.use(requireAuth);

apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/importers', importerRouter);
apiRouter.use('/exporter-profiles', exporterRouter);
apiRouter.use('/bank-profiles', bankRouter);
apiRouter.use('/sign-profiles', signRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/recycle', recycleRouter);
apiRouter.use('/drafts', draftRouter);
apiRouter.use('/currency-settings', currencyRouter);
apiRouter.use('/notifications', notificationRouter);
