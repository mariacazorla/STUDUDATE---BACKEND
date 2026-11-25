import DateModel, { DATE_DURATION_MS, DateStatus } from '../models/Date';
import Grade from '../models/Grade';
import Message from '../models/Message';
import Plan from '../models/Plan';
import User, { AuthUser } from '../models/User';
import type { DateListQuery } from '../middleware/Joi';

// Igual que en los votos: los usuarios del Date se devuelven con su nombre, su email y su foto, tambien
// si estan inactivos (sin withInactive, el prehook de User los dejaria en null). Lo usa tambien el chat
export const POPULATE_USERS ={ path: 'users', select: 'name email photo', options: { withInactive: true } };

// El filtro que dice que Dates puede ver quien hace la peticion: el admin, todos; un usuario normal,
// solo aquellos en los que el es uno de los dos (users contiene su id). Lo usa tambien el chat
export const visibleTo =(requester: AuthUser) => (requester.role === 'admin' ? {} : { users: requester.id });

// Funcion que busca una pagina de Dates, primero los mas nuevos
export const getDates = async ({ page, limit, status, user }: DateListQuery, requester: AuthUser) => {
    const filter = {
        ...visibleTo(requester),
        ...(status ? { status } : {}),
        // El filtro por usuario solo lo puede usar el admin: un usuario normal ya solo ve los suyos
        ...(user && requester.role === 'admin' ? { users: user } : {})
    };

    const [dates, total] = await Promise.all([
        DateModel.find(filter)
            .populate(POPULATE_USERS)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        DateModel.countDocuments(filter)
    ]);

    return {
        dates,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
};

// Funcion que busca un Date por su id. Si quien lo pide no puede verlo, devuelve null (404):
// asi un usuario no puede saber si existen los Dates de otros
export const getDateById = (dateId: string, requester: AuthUser) => {
    return DateModel.findOne({ _id: dateId, ...visibleTo(requester) }).populate(POPULATE_USERS);
};

// Funcion que abre un Date entre dos usuarios.
//   - Comprueba que existen (aunque esten inactivos) y que no hay ya un Date entre los dos
//   - Sortea a quien le toca escribir primero (Math.random da un numero entre 0 y 1)
//   - Caduca en 24 horas
//   - Empieza su historial con la primera entrada: "Pendiente". Sin opener lo abre el servidor por el
//     A+ mutuo (sin autor); con opener, lo ha abierto un admin a mano y queda quien
// Devuelve { error } si algo falla, para que el controlador elija el codigo, o { date } si se ha abierto
export const createDate = async (userA: string, userB: string, opener?: AuthUser) => {
    const [a, b] = await Promise.all([
        User.findById(userA).setOptions({ withInactive: true }),
        User.findById(userB).setOptions({ withInactive: true })
    ]);

    if (!a || !b) {
        return { error: 'user-not-found' };
    }

    // $all: que la lista users tenga los dos ids, en cualquier orden
    const existing = await DateModel.findOne({ users: { $all: [userA, userB] } });

    if (existing) {
        return { error: 'already-exists' };
    }

    const created = await DateModel.create({
        users: [userA, userB],
        firstTurn: Math.random() < 0.5 ? userA : userB,
        expiresAt: new Date(Date.now() + DATE_DURATION_MS),
        history: [opener ? { status: 'pending', by: opener.id, reason: 'Abierto por un admin', at: new Date() } : { status: 'pending', reason: 'A+ mutuo', at: new Date() }]
    });

    return { date: await created.populate(POPULATE_USERS) };
};

// Funcion que cambia el estado de un Date a mano (solo el admin, desde el backoffice; para los
// estudiantes los estados cambian solos: ver sendMessage en ChatService y closeExpiredDates).
// Cada cambio queda en el historial con quien lo hizo, cuando y, si lo ha escrito, por que:
//   - a En curso: si nunca habia empezado, startedAt es ahora
//   - a Cerrado: closedAt es ahora y el motivo es 'admin'
//   - al reabrir un Date cerrado se quitan closedAt y closedReason
// Si el estado es el mismo que ya tenia, no se apunta nada. Devuelve null si el Date no existe
export const updateStatus = async (dateId: string, status: DateStatus, requester: AuthUser, reason?: string) => {
    const date = await DateModel.findOne({ _id: dateId, ...visibleTo(requester) });

    if (!date) {
        return null;
    }

    if (date.status !== status) {
        const at = new Date();

        date.status = status;

        if (status === 'ongoing' && !date.startedAt) {
            date.startedAt = at;
        }

        if (status === 'closed') {
            date.closedAt = at;
            date.closedReason = 'admin';
        } else {
            date.closedAt = undefined;
            date.closedReason = undefined;
        }

        date.history.push({ status, by: requester.id, reason, at });
        await date.save();
    }

    return date.populate(POPULATE_USERS);
};

// Funcion que usa la prorroga: suma 24 horas a la caducidad. Solo hay una prorroga por Date y solo en
// un Date que no este cerrado. La prorroga no cambia el estado, pero es un movimiento del Date y queda
// en el historial (con el estado que tenia, quien la pidio y cuando).
// Devuelve null si no existe (404) y { error } si ya se habia usado o el Date esta cerrado (409)
export const extendDate = async (dateId: string, requester: AuthUser) => {
    const date = await DateModel.findOne({ _id: dateId, ...visibleTo(requester) });

    if (!date) {
        return null;
    }

    if (date.extended) {
        return { error: 'already-extended' as const };
    }

    if (date.status === 'closed') {
        return { error: 'closed' as const };
    }

    date.expiresAt = new Date(date.expiresAt.getTime() + DATE_DURATION_MS);
    date.extended = true;
    date.history.push({ status: date.status, by: requester.id, reason: 'Prórroga de 24 horas', at: new Date() });
    await date.save();

    return { date: await date.populate(POPULATE_USERS) };
};

// Funcion que cierra los Dates pendientes que ya han caducado: nadie escribio en sus 24 horas (o 48
// con la prorroga). La llama el servidor cada minuto (ver jobs/ExpireDates.ts). Un Date en curso no
// caduca: ya estan hablando. El cierre lo hace el servidor, asi que la entrada del historial no lleva
// autor. Devuelve los Dates cerrados, con sus usuarios, para avisar a sus salas del chat
export const closeExpiredDates = async () => {
    const now = new Date();

    // Esta consulta usa el indice compuesto (status, expiresAt) del modelo
    const expired = await DateModel.find({ status: 'pending', expiresAt: { $lte: now } });

    for (const date of expired) {
        date.status = 'closed';
        date.closedAt = now;
        date.closedReason = 'expired';
        date.history.push({ status: 'closed', reason: 'Caducado sin mensajes', at: now });
        await date.save();
    }

    return Promise.all(expired.map((date) => date.populate(POPULATE_USERS)));
};

// Funcion que borra lo que cuelga de unos Dates: su Plan y los mensajes de su chat. Un Plan o un
// mensaje sin su Date no tiene sentido (el populate devolveria date: null y nadie sabria de quien es).
// La usan deleteDate y, al eliminar un usuario para siempre, UserService.deleteUser
export const deleteDateContents = async (dateIds: string[]) => {
    await Promise.all([Plan.deleteMany({ date: { $in: dateIds } }), Message.deleteMany({ date: { $in: dateIds } })]);
};

// Funcion que elimina un Date (borrado fisico). Solo la usa el admin.
// Con el Date se eliminan su Plan y sus mensajes
export const deleteDate = async (dateId: string) => {
    const date = await DateModel.findByIdAndDelete(dateId);

    if (date) {
        await deleteDateContents([String(date._id)]);
    }

    return date;
};

// Funcion que abre un Date si dos usuarios se han dado A+ mutuamente. La llama GradeService cada vez
// que se crea un A+ o se cambia una nota a A+. Si ya habia un Date entre los dos, no hace nada.
// Devuelve el Date abierto, o null si no se ha abierto ninguno
export const openDateIfMutual = async (from: string, to: string) => {
    // ¿Existe el A+ contrario (de "to" a "from")?
    const reverse = await Grade.findOne({ from: to, to: from, value: 'A+' });

    if (!reverse) {
        return null;
    }

    const result = await createDate(from, to);

    return 'date' in result ? result.date : null;
};

export default { getDates, getDateById, createDate, updateStatus, extendDate, closeExpiredDates, deleteDate, deleteDateContents, openDateIfMutual };
