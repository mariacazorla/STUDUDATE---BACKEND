import type { PaginationQuery } from '../middleware/Joi';
import DateModel from '../models/Date';
import Message from '../models/Message';
import type { AuthUser } from '../models/User';
import { POPULATE_USERS, visibleTo } from './DateService';

// El chat de un Date. Aqui estan las reglas que no dependen de como llega el mensaje (hoy por socket.io;
// el historial, por HTTP): quien puede entrar en la sala, quien puede escribir y que pasa con el Date
// cuando llega el primer mensaje. El "yo" sale siempre del token, nunca del payload.

// Por que no se ha podido enviar un mensaje. El socket elige el texto del aviso con esto
export type SendError = 'not-found' | 'closed' | 'not-your-turn';

// Busca un Date del que el usuario es uno de los dos. Devuelve null si no existe o es de otros: asi un
// tercero no puede ni saber si la sala existe
export const findDateOf = (dateId: string, userId: string) => DateModel.findOne({ _id: dateId, users: userId });

// El historial del chat de un Date, paginado. Como en un chat lo ultimo es lo que se ve primero, la
// pagina 1 son los mensajes mas nuevos y la ultima pagina los mas antiguos; dentro de cada pagina van
// en orden cronologico, listos para pintar. La consulta usa el indice (date, createdAt) del modelo.
// Lo puede pedir cualquiera de los dos usuarios del Date (y el admin). Devuelve null si el Date no
// existe o es de otros
export const getMessages = async (dateId: string, { page, limit }: PaginationQuery, requester: AuthUser) => {
    const date = await DateModel.findOne({ _id: dateId, ...visibleTo(requester) });

    if (!date) {
        return null;
    }

    const [newestFirst, total] = await Promise.all([
        Message.find({ date: date._id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Message.countDocuments({ date: date._id })
    ]);

    return {
        messages: newestFirst.reverse(),
        total,
        page,
        pages: Math.ceil(total / limit)
    };
};

// Envia un mensaje a un Date. Las reglas:
//   - solo pueden escribir los dos usuarios del Date (si no, not-found)
//   - en un Date cerrado ya no se escribe (closed)
//   - mientras el Date esta pendiente solo puede escribir quien tiene el primer turno, el que salio en el
//     sorteo al abrirlo (not-your-turn). Despues del primer mensaje escriben los dos
// El primer mensaje pasa el Date a "En curso": startedAt es la hora de ese mensaje y el cambio queda en
// el historial con quien lo hizo. Devuelve el mensaje guardado y, si el Date ha cambiado, el Date entero
// (con los usuarios) para que el chat lo reenvie a la sala
export const sendMessage = async (dateId: string, from: string, text: string) => {
    const date = await findDateOf(dateId, from);

    if (!date) {
        return { error: 'not-found' as const };
    }

    if (date.status === 'closed') {
        return { error: 'closed' as const };
    }

    if (date.status === 'pending' && String(date.firstTurn) !== from) {
        return { error: 'not-your-turn' as const };
    }

    const message = await Message.create({ date: date._id, from, text });

    if (date.status !== 'pending') {
        return { message, date: null };
    }

    // El primer mensaje: el Date pasa a En curso y lo apuntamos en su historial
    date.status = 'ongoing';
    date.startedAt = message.createdAt;
    date.history.push({ status: 'ongoing', by: from, reason: 'Primer mensaje', at: message.createdAt });
    await date.save();

    return { message, date: await date.populate(POPULATE_USERS) };
};

// Marca como leidos los mensajes que la otra persona me ha escrito en un Date (los que aun no tienen
// readAt). Devuelve cuando se han leido, o null si el Date no es mio
export const markRead = async (dateId: string, userId: string) => {
    const date = await findDateOf(dateId, userId);

    if (!date) {
        return null;
    }

    const at = new Date();

    // $ne: los mensajes que no son mios. $exists: false: los que todavia no estaban leidos
    await Message.updateMany({ date: date._id, from: { $ne: userId }, readAt: { $exists: false } }, { readAt: at });

    return at;
};

export default { findDateOf, getMessages, sendMessage, markRead };
