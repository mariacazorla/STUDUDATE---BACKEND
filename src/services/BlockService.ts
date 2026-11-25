import Block from '../models/Block';
import DateModel from '../models/Date';
import User from '../models/User';
import { POPULATE_USERS } from './DateService';

// Los bloqueos: un usuario decide que no quiere volver a ver a otro. Desde ese momento ninguno de los
// dos le sale al otro en La Orla (OrlaService ya filtra los bloqueos en los dos sentidos) ni en los
// chats (el Date que tuvieran se cierra). A la persona bloqueada no se le avisa de nada.
// El que bloquea sale siempre del token, nunca del body.

// Lo que puede salir mal al bloquear. El controlador lo traduce a un codigo HTTP
export type BlockError = 'same-user' | 'not-found' | 'already-blocked';

// Los usuarios que he bloqueado, con lo justo para enseñarlos (y poder desbloquearlos)
const POPULATE_BLOCKED = { path: 'blocked', select: 'name degree photo', options: { withInactive: true } };

// Funcion que devuelve mis bloqueos, del mas nuevo al mas antiguo
export const getMyBlocks = (blockerId: string) => {
    return Block.find({ blocker: blockerId }).populate(POPULATE_BLOCKED).sort({ createdAt: -1 });
};

// Funcion que bloquea a un usuario.
//   - No me puedo bloquear a mi mismo (422)
//   - El otro tiene que existir y ser estudiante (404). Se busca con withInactive: bloquear a alguien
//     que acaban de desactivar tambien tiene sentido
//   - Solo un bloqueo por pareja (409)
//   - Si teniamos un Date abierto, se cierra: closedReason 'blocked' y una entrada en el historial con
//     quien bloqueo. Si ya estaba cerrado, se deja como estaba
// Devuelve el bloqueo y el Date cerrado (o null), para que el controlador avise a la sala del chat
export const block = async (blockerId: string, blockedId: string) => {
    if (blockerId === blockedId) {
        return { error: 'same-user' as const };
    }

    const target = await User.findById(blockedId).setOptions({ withInactive: true });

    if (!target || target.role !== 'user') {
        return { error: 'not-found' as const };
    }

    const existing = await Block.findOne({ blocker: blockerId, blocked: blockedId });

    if (existing) {
        return { error: 'already-blocked' as const };
    }

    const created = await Block.create({ blocker: blockerId, blocked: blockedId });

    // El Date entre los dos, si lo hay y sigue abierto, se cierra por el bloqueo
    const date = await DateModel.findOne({ users: { $all: [blockerId, blockedId] }, status: { $ne: 'closed' } });

    if (date) {
        const at = new Date();

        date.status = 'closed';
        date.closedAt = at;
        date.closedReason = 'blocked';
        date.history.push({ status: 'closed', by: blockerId, reason: 'Bloqueo', at });
        await date.save();
    }

    return { block: created, date: date ? await date.populate(POPULATE_USERS) : null };
};

// Funcion que quita un bloqueo mio. El Date cerrado no se reabre: si se quieren volver a ver, tendran
// que darse A+ otra vez en La Orla. Devuelve null si no habia tal bloqueo (404)
export const unblock = (blockerId: string, blockedId: string) => {
    return Block.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
};

// Funcion que dice si hay un bloqueo entre dos usuarios, en cualquiera de los dos sentidos.
// La usan La Orla (para no enseñar ni dejar votar) y los partes
export const isBlockedBetween = async (a: string, b: string) => {
    const found = await Block.findOne({ $or: [{ blocker: a, blocked: b }, { blocker: b, blocked: a }] });

    return found !== null;
};

export default { getMyBlocks, block, unblock, isBlockedBetween };
