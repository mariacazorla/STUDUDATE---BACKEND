import { NextFunction, Request, Response } from 'express';
import BlockService from '../services/BlockService';
import { emitDateUpdated } from '../sockets/Chat';

// Los bloqueos del usuario con sesion. El que bloquea es siempre req.user (lo deja VerifyToken);
// las rutas piden rol 'user': el admin no bloquea, para eso tiene el backoffice.

// GET /blocks: a quien he bloqueado
const readMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blocks = await BlockService.getMyBlocks(req.user!.id);

        res.status(200).json({ blocks });
    } catch (error) {
        next(error);
    }
};

// POST /blocks: bloquear a alguien. Si teniamos un Date, se cierra y la sala del chat se entera
const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await BlockService.block(req.user!.id, req.body.blocked);

        if ('block' in result) {
            if (result.date) {
                emitDateUpdated(result.date);
            }

            // 201: bloqueado. date es el Date que se ha cerrado, o null si no habia
            res.status(201).json({ block: result.block, date: result.date });
        } else if (result.error === 'same-user') {
            res.status(422).json({ message: 'No puedes bloquearte a ti mismo' });
        } else if (result.error === 'not-found') {
            res.status(404).json({ message: 'Ese estudiante no existe' });
        } else {
            res.status(409).json({ message: 'Ya tienes bloqueada a esta persona' });
        }
    } catch (error) {
        next(error);
    }
};

// DELETE /blocks/:userId: quitar un bloqueo mio
const remove = async (req: Request<{ userId: string }>, res: Response, next: NextFunction) => {
    try {
        const removed = await BlockService.unblock(req.user!.id, req.params.userId);

        if (removed) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { readMine, create, remove };
