import jwt, { TokenExpiredError } from 'jsonwebtoken';

import { config } from '../config/config';
import Logging from '../library/Logging';
import type { AccessTokenPayload } from '../models/User';
import UserService from '../services/UserService';
import type { ChatSocket } from '../sockets/events';

// Mensajes con los que se rechaza una conexion. Son los mismos que da la API en el 401 para que el
// frontend reaccione igual: con "El token ha caducado" renueva el token y vuelve a conectar; con los
// demas cierra la sesion
export const SOCKET_AUTH_ERRORS = {
    missing: 'Falta el token',
    expired: 'El token ha caducado',
    invalid: 'Token no válido',
    inactive: 'Tu cuenta no está activa'
};

// Middleware de socket.io: se ejecuta una sola vez, cuando un cliente intenta conectarse. Es el
// equivalente a VerifyToken para el chat. El cliente envia el access token en el handshake:
//
//     io(url, { auth: { token } })
//
// Si el token falta, es falso, ha caducado, es un refresh token (esta firmado con otro secreto) o el
// usuario ya no esta activo, la conexion se rechaza: el cliente recibe un connect_error con el mensaje
// y no llega a entrar en ninguna sala. Si es valido, el usuario queda en socket.data.user y el chat lo
// lee de ahi: quien escribe sale siempre del token, nunca de lo que mande el cliente.
//
// El token solo se comprueba al conectar: un socket ya abierto sigue funcionando aunque el token
// caduque despues. Como el access token dura 15 minutos y una conversacion puede durar mas, el
// cliente no tiene que reconectar cada vez que renueva el token.
export const VerifySocketToken = async (socket: ChatSocket, next: (error?: Error) => void) => {
    const token = socket.handshake.auth?.token;

    if (typeof token !== 'string' || token.length === 0) {
        Logging.warning('Socket rechazado: falta el token');
        return next(new Error(SOCKET_AUTH_ERRORS.missing));
    }

    try {
        // jwt.verify comprueba la firma con nuestro secreto y que el token no haya caducado
        const payload = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

        // Igual que en VerifyToken: el usuario tiene que seguir existiendo y estar activo
        const user = await UserService.getUserById(payload.sub);

        if (!user) {
            Logging.warning(`Socket rechazado: la cuenta ${payload.sub} no está activa`);
            return next(new Error(SOCKET_AUTH_ERRORS.inactive));
        }

        socket.data.user = { id: payload.sub, role: payload.role };
        next();
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            Logging.warning('Socket rechazado: el token ha caducado');
            return next(new Error(SOCKET_AUTH_ERRORS.expired));
        }

        Logging.warning('Socket rechazado: token no válido');
        next(new Error(SOCKET_AUTH_ERRORS.invalid));
    }
};

export default VerifySocketToken;
