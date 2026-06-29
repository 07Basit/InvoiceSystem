import { Router } from 'express';
import invoiceRouter from './invoice-routes';
import importerRouter from './importer-routes';
import exporterRouter from './exporter-routes';
import documentRouter from './document-routes';
import dashboardRouter from './dashboard-routes';
import recycleRouter from './recycle-routes';

export const apiRouter = Router();

apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/importers', importerRouter);
apiRouter.use('/exporter-profile', exporterRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/recycle', recycleRouter);
