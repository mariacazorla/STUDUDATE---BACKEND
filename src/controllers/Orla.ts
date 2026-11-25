import { NextFunction, Request, Response } from 'express';
import OrlaService from '../services/OrlaService';

// El id del usuario con sesion. VerifyToken siempre lo ha dejado en req.user antes de llegar aqui
// (las rutas de /orla pasan por VerifyToken + RequireRole('user')), asi que no puede ser undefined.
const meId = (req: Request) => req.user!.id;

// GET /orla/next: el siguiente Expediente y cuantos A+ me quedan hoy
const next = async (req: Request, res: Response, nextFn: NextFunction) => {
    try {
        const result = await OrlaService.getNext(meId(req));

        res.status(200).json(result);
    } catch (error) {
        nextFn(error);
    }
};

export default { next };
