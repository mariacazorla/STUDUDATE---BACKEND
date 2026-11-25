import { NextFunction, Request, Response } from 'express';
import type { AlertListQuery } from '../middleware/Joi';
import SafetyAlertService from '../services/SafetyAlertService';
import { emitToAdmins } from '../sockets/Chat';

// Las alertas del boton de ayuda: el estudiante las crea (POST) y el admin las lista y las atiende.
// Quien pide ayuda es siempre req.user; las rutas del admin piden RequireRole('admin').

// POST /alerts: pedir ayuda. Los admin conectados reciben la alerta al momento por el socket
const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await SafetyAlertService.createAlert(req.user!.id, req.body);

        if ('alert' in result) {
            emitToAdmins('alert:new', result.alert);

            // 201: alerta creada. contactsNotified dice a cuantos contactos de confianza se ha avisado (0 si no tiene)
            res.status(201).json({ alert: result.alert, contactsNotified: result.contactsNotified });
        } else if (result.error === 'date-not-yours') {
            res.status(422).json({ message: 'Ese Date no es tuyo' });
        } else {
            res.status(422).json({ message: 'Ese Plan no es tuyo' });
        }
    } catch (error) {
        next(error);
    }
};

// GET /alerts: una pagina de alertas (solo admin)
const readAll = async (req: Request, res: Response<unknown, { query: AlertListQuery }>, next: NextFunction) => {
    try {
        const result = await SafetyAlertService.getAlerts(res.locals.query);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// GET /alerts/:alertId: una alerta (solo admin)
const readOne = async (req: Request<{ alertId: string }>, res: Response, next: NextFunction) => {
    try {
        const alert = await SafetyAlertService.getAlertById(req.params.alertId);

        if (alert) {
            res.status(200).json({ alert });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// PUT /alerts/:alertId/attend: atender una alerta (solo admin). El resto de admin lo ven al momento
const attend = async (req: Request<{ alertId: string }>, res: Response, next: NextFunction) => {
    try {
        const alert = await SafetyAlertService.attendAlert(req.params.alertId, req.user!, req.body.status);

        if (alert) {
            emitToAdmins('alert:updated', alert);
            res.status(200).json({ alert });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { create, readAll, readOne, attend };
