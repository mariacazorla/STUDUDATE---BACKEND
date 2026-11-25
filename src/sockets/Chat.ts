import http from 'http';
import { Server } from 'socket.io';

import { config } from '../config/config';
import Logging from '../library/Logging';
import { VerifySocketToken } from '../middleware/SocketAuth';
import type { ChatServer } from './events';

// El chat de los Dates va por socket.io, enganchado al mismo servidor HTTP que Express: la API y el
// chat comparten puerto (y, en el servidor, nginx reenvia /socket.io al mismo contenedor).
//
// El flujo, de principio a fin:
//   1. El cliente se conecta enviando su access token; VerifySocketToken lo comprueba. Sin token
//      valido no hay conexion.
//   2. El cliente emite date:join con el id de un Date; el servidor comprueba que es uno de los dos
//      usuarios de ese Date y lo mete en su sala.
//   3. El cliente emite date:message; el servidor aplica las reglas del Date (turno, cerrado), guarda
//      el mensaje en MongoDB y lo emite a todos los que estan en esa sala, incluido quien lo escribio.
export const StartChat = (server: http.Server) => {
    const io: ChatServer = new Server(server, {
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

        socket.on('disconnect', () => {
            Logging.info(`Socket desconectado: usuario ${userId}`);
        });
    });

    return io;
};
