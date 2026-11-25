import type { DefaultEventsMap, Server, Socket } from 'socket.io';

import type { AuthUser } from '../models/User';

// El contrato del chat por socket.io: que eventos manda el cliente, cuales manda el servidor y que
// lleva cada uno. El frontend (web y movil) tiene las mismas interfaces en packages/shared. Si algo de
// aqui cambia, se cambia en los dos sitios.
//
// Cada Date es una sala: el cliente entra con date:join y a partir de ahi recibe todo lo que pasa en
// ese Date (mensajes, cambios de estado, lecturas) sin recargar.

// Lo que envia el cliente
export interface ClientToServerEvents {
    // Entrar en la sala de un Date. Solo pueden los dos usuarios del Date
    'date:join': (payload: { dateId: string }) => void;

    // Salir de la sala (por ejemplo, al cambiar de pantalla)
    'date:leave': (payload: { dateId: string }) => void;

    // Enviar un mensaje a un Date. Quien lo escribe sale del token, nunca del payload
    'date:message': (payload: { dateId: string; text: string }) => void;

    // Marcar como leidos los mensajes de la otra persona en ese Date
    'date:read': (payload: { dateId: string }) => void;
}

// Un mensaje tal como viaja por el socket (lo mismo que devuelve GET /dates/:dateId/messages)
export interface ChatMessage {
    _id: string;
    date: string;
    from: string;
    text: string;
    readAt?: Date;
    createdAt: Date;
}

// Lo que envia el servidor
export interface ServerToClientEvents {
    // Confirmacion de que el socket ya esta en la sala del Date
    'date:joined': (payload: { dateId: string }) => void;

    // Un mensaje nuevo en un Date en el que estoy (tambien los mios, ya guardados)
    'date:message': (message: ChatMessage) => void;

    // El Date ha cambiado (ha pasado a En curso, se ha cerrado, se ha usado la prorroga...).
    // Llega el Date entero, con los dos usuarios y su historial, para que el cliente lo sustituya
    'date:updated': (date: unknown) => void;

    // La otra persona ha leido mis mensajes de ese Date
    'date:read': (payload: { dateId: string; by: string; at: Date }) => void;

    // Algo no se ha podido hacer (sala ajena, Date cerrado, no es tu turno, texto no valido...)
    'chat:error': (payload: { message: string }) => void;

    // ---- Solo para los admin (sala 'admins', en la que entran al conectar) ----

    // Alguien ha pulsado el boton de ayuda: la alerta, con quien la pide
    'alert:new': (alert: unknown) => void;

    // Una alerta ha cambiado (un admin la ha atendido): para que los demas admin lo vean sin recargar
    'alert:updated': (alert: unknown) => void;
}

// Lo que el servidor guarda de cada socket: el usuario del token, que deja VerifySocketToken
export interface SocketData {
    user: AuthUser;
}

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;
