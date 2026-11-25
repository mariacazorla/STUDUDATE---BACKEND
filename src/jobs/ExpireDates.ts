import Logging from '../library/Logging';
import DateService from '../services/DateService';
import { emitDateUpdated } from '../sockets/Chat';

// Cada cuanto mira el servidor si hay Dates caducados. Un minuto es suficiente: un Date dura 24 horas
export const EXPIRE_CHECK_MS = 60 * 1000;

// Tarea periodica del servidor: cierra los Dates pendientes que han caducado sin que nadie escribiera.
// Los estudiantes no cambian los Dates a mano: los estados cambian solos (el primer mensaje los pone En
// curso y esta tarea los cierra), y cada cambio queda en el historial. Los Dates que se cierran se avisan
// a su sala del chat, para que quien tenga la conversacion abierta lo vea sin recargar.
//
// Se ejecuta una vez al arrancar (por si el servidor estuvo parado) y despues cada minuto.
export const StartExpireDates = () => {
    const run = async () => {
        try {
            const closed = await DateService.closeExpiredDates();

            if (closed.length > 0) {
                Logging.info(`Dates caducados cerrados: ${closed.length}`);
                closed.forEach(emitDateUpdated);
            }
        } catch (error) {
            // Un fallo en una vuelta no tiene que parar las siguientes
            Logging.error(error);
        }
    };

    run();

    // unref: este temporizador no mantiene vivo el proceso por si solo (el servidor HTTP ya lo hace)
    setInterval(run, EXPIRE_CHECK_MS).unref();
};
