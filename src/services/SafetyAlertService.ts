import Logging from '../library/Logging';
import type { AlertListQuery } from '../middleware/Joi';
import DateModel from '../models/Date';
import Plan from '../models/Plan';
import SafetyAlert from '../models/SafetyAlert';
import User, { AuthUser } from '../models/User';

// El boton de ayuda: un estudiante pide ayuda durante un Date y se avisa al momento a los admin (por el
// socket, ver sockets/Chat.ts) y a sus contactos de confianza, si los tiene. Los contactos son
// opcionales: sin ellos, la alerta se crea igual y la ven los admin. Queda guardado quien la atendio y cuando.

// Como en los partes: quien pide ayuda llega con su nombre, email y foto, tambien si esta inactivo
const POPULATE_USER = { path: 'user', select: 'name email photo', options: { withInactive: true } };

// Lo que puede salir mal al pedir ayuda. El controlador lo traduce a un codigo HTTP
export type AlertError = 'date-not-yours' | 'plan-not-yours';

// Lo que manda el estudiante. Todo opcional: quien pide ayuda no esta para rellenar formularios
export interface NewAlert {
    date?: string;
    plan?: string;
    message?: string;
}

// Funcion que crea una alerta y avisa a los contactos de confianza.
//   - Si viene un Date (o un Plan), tiene que ser mio: asi el admin sabe de verdad con quien estaba (422 si no)
//   - El aviso a los contactos es simulado, como el email de bienvenida: se escribe en el log del servidor
//     un mensaje por contacto. El aviso a los admin lo manda el controlador por el socket
// Devuelve la alerta (con el usuario) y a cuantos contactos se ha avisado
export const createAlert = async (userId: string, data: NewAlert) => {
    if (data.date) {
        const date = await DateModel.findOne({ _id: data.date, users: userId });

        if (!date) {
            return { error: 'date-not-yours' as const };
        }
    }

    if (data.plan) {
        const plan = await Plan.findById(data.plan).populate({ path: 'date', select: 'users' });
        const users = (plan?.date as { users?: unknown[] } | null)?.users ?? [];

        if (!plan || !users.map(String).includes(userId)) {
            return { error: 'plan-not-yours' as const };
        }
    }

    const created = await SafetyAlert.create({ user: userId, date: data.date, plan: data.plan, message: data.message });
    const alert = await created.populate(POPULATE_USER);

    // Los contactos de confianza tienen select: false: se piden a proposito solo aqui y en Mi perfil
    const me = await User.findById(userId).select('+trustedContacts');
    const contacts = me?.trustedContacts ?? [];

    for (const contact of contacts) {
        Logging.warning(`Email simulation: safety alert from ${me?.email} sent to ${contact.name} <${contact.email}>${data.message ? ` ("${data.message}")` : ''}`);
    }

    return { alert, contactsNotified: contacts.length };
};

// Funcion que busca una pagina de alertas para el backoffice, primero las mas nuevas. Se puede filtrar
// por estado: las abiertas son las que hay que atender
export const getAlerts = async ({ page, limit, status }: AlertListQuery) => {
    const filter = status ? { status } : {};

    const [alerts, total] = await Promise.all([
        SafetyAlert.find(filter)
            .populate(POPULATE_USER)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        SafetyAlert.countDocuments(filter)
    ]);

    return {
        alerts,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
};

// Funcion que busca una alerta por su id (solo admin)
export const getAlertById = (alertId: string) => {
    return SafetyAlert.findById(alertId).populate(POPULATE_USER);
};

// Funcion que atiende una alerta: la deja como atendida o falsa alarma y apunta que admin lo hizo y
// cuando. Devuelve null si no existe (404)
export const attendAlert = (alertId: string, admin: AuthUser, status: 'attended' | 'false_alarm') => {
    return SafetyAlert.findByIdAndUpdate(alertId, { status, attendedBy: admin.id, attendedAt: new Date() }, { new: true, runValidators: true }).populate(
        POPULATE_USER
    );
};

export default { createAlert, getAlerts, getAlertById, attendAlert };
