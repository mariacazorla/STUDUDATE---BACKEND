import { NextFunction, Request, Response } from 'express';
import type { DateListQuery, PaginationQuery } from '../middleware/Joi';
import ChatService from '../services/ChatService';
import DateService from '../services/DateService';
import { emitDateUpdated } from '../sockets/Chat';

// Los Dates los usan el admin (todos) y los usuarios normales (solo los suyos). Cada funcion le pasa
// al service quien hace la peticion (req.user, que deja VerifyToken) para que filtre lo que puede ver.
// Abrirlos y cambiarlos de estado a mano es solo del admin (lo comprueba la ruta): para los estudiantes
// los Dates se abren con el A+ mutuo y cambian de estado solos (primer mensaje, caducidad).

// Función para obtener una pagina de Dates
const readAll = async (req: Request, res: Response<unknown, { query: DateListQuery }>, next: NextFunction) => {
    try {
        const result = await DateService.getDates(res.locals.query, req.user!);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// Función para buscar un Date concreto usando su ID
const readDate = async (req: Request<{ dateId: string }>, res: Response, next: NextFunction) => {
    try {
        const date = await DateService.getDateById(req.params.dateId, req.user!);

        if (date) {
            res.status(200).json({ date });
        } else {
            // No existe, o es de otros usuarios
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// Función para abrir un Date entre dos usuarios a mano (solo admin). Queda en el historial quien lo abrio
const createDate = async (req: Request, res: Response, next: NextFunction) => {
    const [userA, userB] = req.body.users as string[];

    try {
        const result = await DateService.createDate(userA, userB, req.user!);

        if ('date' in result) {
            res.status(201).json({ date: result.date });
        } else if (result.error === 'already-exists') {
            // 409: ya hay un Date entre esos dos usuarios
            res.status(409).json({ message: 'Ya hay un Date entre estos dos usuarios' });
        } else {
            res.status(404).json({ message: 'Alguno de los dos usuarios no existe' });
        }
    } catch (error) {
        next(error);
    }
};

// Función para cambiar un Date de bandeja a mano (solo admin). El cambio queda en el historial y se
// avisa a la sala del chat, por si los dos usuarios lo tienen abierto
const updateDate = async (req: Request<{ dateId: string }>, res: Response, next: NextFunction) => {
    try {
        const date = await DateService.updateStatus(req.params.dateId, req.body.status, req.user!, req.body.reason || undefined);

        if (date) {
            emitDateUpdated(date);
            res.status(200).json({ date });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// Función para usar la prorroga de un Date (24 horas mas, solo una vez). La otra persona se entera por el chat
const extendDate = async (req: Request<{ dateId: string }>, res: Response, next: NextFunction) => {
    try {
        const result = await DateService.extendDate(req.params.dateId, req.user!);

        if (!result) {
            res.status(404).json({ message: 'not found' });
        } else if ('date' in result && result.date) {
            emitDateUpdated(result.date);
            res.status(200).json({ date: result.date });
        } else if (result.error === 'closed') {
            // 409: un Date cerrado ya no se prorroga
            res.status(409).json({ message: 'Este Date está cerrado' });
        } else {
            // 409: el Date existe, pero la prorroga ya se habia usado
            res.status(409).json({ message: 'La prórroga de este Date ya se ha usado' });
        }
    } catch (error) {
        next(error);
    }
};

// Función para leer el historial del chat de un Date, paginado (la pagina 1 son los mas nuevos)
const readMessages = async (req: Request<{ dateId: string }>, res: Response<unknown, { query: PaginationQuery }>, next: NextFunction) => {
    try {
        const result = await ChatService.getMessages(req.params.dateId, res.locals.query, req.user!);

        if (result) {
            res.status(200).json(result);
        } else {
            // No existe, o es de otros usuarios
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// Función para eliminar un Date (solo admin, lo comprueba la ruta)
const deleteDate = async (req: Request<{ dateId: string }>, res: Response, next: NextFunction) => {
    try {
        const date = await DateService.deleteDate(req.params.dateId);

        if (date) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { readAll, readDate, createDate, updateDate, extendDate, readMessages, deleteDate };
