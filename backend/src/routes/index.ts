import { Router } from 'express';
import invoiceRouter from './invoice-routes';
import importerRouter from './importer-routes';
import exporterRouter from './exporter-routes';
import documentRouter from './document-routes';
import dashboardRouter from './dashboard-routes';
import recycleRouter from './recycle-routes';
import authRouter from './auth-routes';
import { requireAuth, requireCsrfHeader } from '../middleware/auth';

export const apiRouter = Router();

// Public: login. Everything registered after requireAuth needs a valid bearer token.
apiRouter.use(requireCsrfHeader);
apiRouter.use('/auth', authRouter);
apiRouter.use(requireAuth);

apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/importers', importerRouter);
apiRouter.use('/exporter-profile', exporterRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/recycle', recycleRouter);
