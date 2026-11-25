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

// POST /orla/votes: votar un Expediente. El controlador traduce el error del service a su codigo
const vote = async (req: Request, res: Response, nextFn: NextFunction) => {
    try {
        const result = await OrlaService.vote(meId(req), req.body.to, req.body.value);

        if ('grade' in result) {
            // 201: voto creado. date va solo si este A+ ha abierto un Date (A+ mutuo)
            res.status(201).json({ grade: result.grade, date: result.date, remaining: result.remaining });
        } else if (result.error === 'same-user') {
            res.status(422).json({ message: 'No puedes votarte a ti mismo' });
        } else if (result.error === 'not-found') {
            res.status(404).json({ message: 'Ese estudiante no existe o ya no está disponible' });
        } else if (result.error === 'blocked') {
            // 403: hay un bloqueo entre los dos, en un sentido o en el otro
            res.status(403).json({ message: 'No puedes votar a esta persona' });
        } else {
            // already-voted
            res.status(409).json({ message: 'Ya has votado este Expediente' });
        }
    } catch (error) {
        nextFn(error);
    }
};

export default { next, vote };
