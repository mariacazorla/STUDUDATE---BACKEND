import http from 'http';
import { Server } from 'socket.io';

import { config } from '../config/config';
import Logging from '../library/Logging';
import { Schemas } from '../middleware/Joi';
import { VerifySocketToken } from '../middleware/SocketAuth';
import ChatService from '../services/ChatService';
import type { ChatMessage, ChatServer } from './events';

// Un id de MongoDB: 24 caracteres hexadecimales. Los tipos de TypeScript no validan lo que llega por la
// red, asi que cada payload se comprueba a mano antes de usarlo
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// El nombre de la sala de un Date. Cada Date es una sala: solo entran sus dos usuarios
const roomOf = (dateId: string) => `date:${dateId}`;

// Los avisos de error que recibe el cliente (chat:error). El detalle real queda en el log del servidor
const ERRORS = {
    invalidDate: 'El Date indicado no es válido',
    notYourDate: 'No puedes entrar en este Date',
    notJoined: 'Entra en el Date antes de escribir',
    closed: 'Este Date está cerrado: ya no se puede escribir',
    notYourTurn: 'Todavía no es tu turno: empieza la otra persona',
    sendFailed: 'No se ha podido enviar el mensaje'
};

// Guardamos el servidor de socket.io para que otras partes de la API (el cierre de los Dates caducados,
// la prorroga) puedan avisar a la sala de un Date de que ha cambiado, sin que el cliente recargue
let io: ChatServer | null = null;

// Envia un Date (ya con sus usuarios) a su sala. Si el chat no esta arrancado (el seed, por ejemplo), no hace nada
export const emitDateUpdated = (date: { _id: unknown }) => {
    io?.to(roomOf(String(date._id))).emit('date:updated', date);
};

// El chat de los Dates va por socket.io, enganchado al mismo servidor HTTP que Express: la API y el
// chat comparten puerto (y, en el servidor, nginx reenvia /socket.io al mismo contenedor).
//
// El flujo, de principio a fin:
//   1. El cliente se conecta enviando su access token; VerifySocketToken lo comprueba. Sin token
//      valido no hay conexion.
//   2. El cliente emite date:join con el id de un Date; el servidor comprueba que es uno de los dos
//      usuarios de ese Date y lo mete en su sala (socket.join).
//   3. El cliente emite date:message; el servidor aplica las reglas del Date (turno, cerrado), guarda
//      el mensaje en MongoDB y lo emite a todos los que estan en esa sala (io.to(sala).emit), incluido
//      quien lo escribio. Si era el primer mensaje, la sala recibe ademas el Date ya "En curso".
export const StartChat = (server: http.Server) => {
    io = new Server(server, {
        // Los mismos origenes que la API: el navegador manda la peticion del handshake con Origin
        cors: {
            origin: config.cors.origins,
            credentials: true
        }
    });

    io.use(VerifySocketToken);

    io.on('connection', (socket) => {
        // El middleware ya comprobo la identidad antes de dejar pasar esta conexion
        const userId = socket.data.user.id;
        Logging.info(`Socket conectado: usuario ${userId}`);

        // El cliente pide entrar en la sala de un Date
        socket.on('date:join', async (payload) => {
            if (!payload || typeof payload.dateId !== 'string' || !OBJECT_ID.test(payload.dateId)) {
                socket.emit('chat:error', { message: ERRORS.invalidDate });
                return;
            }

            try {
                // Solo los dos usuarios del Date. Para un tercero, el Date "no existe"
                const date = await ChatService.findDateOf(payload.dateId, userId);

                if (!date) {
                    Logging.warning(`El usuario ${userId} ha intentado entrar en el Date ${payload.dateId}, que no es suyo`);
                    socket.emit('chat:error', { message: ERRORS.notYourDate });
                    return;
                }

                await socket.join(roomOf(payload.dateId));
                socket.emit('date:joined', { dateId: payload.dateId });
            } catch (error) {
                Logging.error(error);
                socket.emit('chat:error', { message: ERRORS.notYourDate });
            }
        });

        // El cliente sale de la sala (al cambiar de pantalla, por ejemplo)
        socket.on('date:leave', (payload) => {
            if (payload && typeof payload.dateId === 'string') {
                socket.leave(roomOf(payload.dateId));
            }
        });

        // El cliente envia un mensaje a un Date
        socket.on('date:message', async (payload) => {
            if (!payload || typeof payload.dateId !== 'string' || !OBJECT_ID.test(payload.dateId)) {
                socket.emit('chat:error', { message: ERRORS.invalidDate });
                return;
            }

            // Solo se escribe en un Date en el que ya se ha entrado (y date:join ya comprobo que es suyo)
            if (!socket.rooms.has(roomOf(payload.dateId))) {
                socket.emit('chat:error', { message: ERRORS.notJoined });
                return;
            }

            // El texto se valida con el mismo esquema de Joi que usaria una ruta HTTP: de 1 a 1000 caracteres
            const { error, value } = Schemas.message.create.validate({ text: payload.text });

            if (error) {
                socket.emit('chat:error', { message: error.details[0].message });
                return;
            }

            try {
                // El autor sale del token verificado, nunca del payload
                const result = await ChatService.sendMessage(payload.dateId, userId, value.text);

                if ('error' in result) {
                    const message = result.error === 'closed' ? ERRORS.closed : result.error === 'not-your-turn' ? ERRORS.notYourTurn : ERRORS.notYourDate;
                    socket.emit('chat:error', { message });
                    return;
                }

                // El mensaje ya guardado, a todos los de la sala (tambien a quien lo escribio: asi su
                // pantalla lo pinta con el _id y la hora que le ha puesto MongoDB)
                io?.to(roomOf(payload.dateId)).emit('date:message', result.message.toJSON() as unknown as ChatMessage);

                // Si era el primer mensaje, el Date ha pasado a En curso: la sala recibe el Date nuevo
                if (result.date) {
                    emitDateUpdated(result.date);
                }
            } catch (error) {
                Logging.error(error);
                socket.emit('chat:error', { message: ERRORS.sendFailed });
            }
        });

        // El cliente ha leido los mensajes de la otra persona
        socket.on('date:read', async (payload) => {
            if (!payload || typeof payload.dateId !== 'string' || !OBJECT_ID.test(payload.dateId) || !socket.rooms.has(roomOf(payload.dateId))) {
                return;
            }

            try {
                const at = await ChatService.markRead(payload.dateId, userId);

                if (at) {
                    io?.to(roomOf(payload.dateId)).emit('date:read', { dateId: payload.dateId, by: userId, at });
                }
            } catch (error) {
                Logging.error(error);
            }
        });

        socket.on('disconnect', () => {
            Logging.info(`Socket desconectado: usuario ${userId}`);
        });
    });

    return io;
};
