import { NextFunction, Request, Response } from 'express';
import type { ReportListQuery } from '../middleware/Joi';
import ReportService from '../services/ReportService';

// Los partes: el estudiante los manda (POST) y el admin los lista y los revisa. Quien manda el parte
// es siempre req.user; las rutas del admin piden RequireRole('admin').

// POST /reports: mandar un parte sobre alguien
const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ReportService.createReport(req.user!.id, req.body);

        if ('report' in result) {
            res.status(201).json({ report: result.report });
        } else if (result.error === 'same-user') {
            res.status(422).json({ message: 'No puedes mandar un parte sobre ti mismo' });
        } else if (result.error === 'not-found') {
            res.status(404).json({ message: 'Ese usuario no existe' });
        } else {
            // date-not-yours: el Date no es mio o no es con esa persona
            res.status(422).json({ message: 'Ese Date no es tuyo' });
        }
    } catch (error) {
        next(error);
    }
};

// GET /reports: una pagina de partes (solo admin)
const readAll = async (req: Request, res: Response<unknown, { query: ReportListQuery }>, next: NextFunction) => {
    try {
        const result = await ReportService.getReports(res.locals.query);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// GET /reports/:reportId: un parte (solo admin)
const readOne = async (req: Request<{ reportId: string }>, res: Response, next: NextFunction) => {
    try {
        const report = await ReportService.getReportById(req.params.reportId);

        if (report) {
            res.status(200).json({ report });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// PUT /reports/:reportId/review: revisar un parte (solo admin)
const review = async (req: Request<{ reportId: string }>, res: Response, next: NextFunction) => {
    try {
        const report = await ReportService.reviewReport(req.params.reportId, req.user!, req.body);

        if (report) {
            res.status(200).json({ report });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { create, readAll, readOne, review };
