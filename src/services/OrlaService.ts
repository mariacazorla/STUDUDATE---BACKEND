import Block from '../models/Block';
import DateModel from '../models/Date';
import Grade, { GradeValue } from '../models/Grade';
import User from '../models/User';
import { deleteDate, openDateIfMutual } from './DateService';

// La Orla es la pantalla del estudiante: va viendo Expedientes y les pone A+ o F. Este service tiene lo
// que no hace el admin: el siguiente perfil, votar como estudiante, el cupo del dia y deshacer.
// El CRUD de votos del backoffice sigue en GradeService; aqui el "yo" sale siempre del token.

// Cuantos A+ puede dar un estudiante en un dia natural. El 31 ya no se deja: hay que esperar a mañana.
export const DAILY_A_PLUS_CAP = 30;

// Cuanto tiempo hay para deshacer un voto, en milisegundos. Pasados 10 s, el voto se queda.
export const UNDO_WINDOW_MS = 10_000;

// Los campos del Expediente: lo que se ve de otro estudiante en La Orla. Nunca el email ni nada privado.
const EXPEDIENTE_FIELDS = 'name degree lookingFor bio photo birthDate';

// Las 00:00 de hoy, para contar solo los A+ de hoy
const startOfToday = () => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
};

// Cuantos A+ le quedan hoy al usuario. Nunca baja de 0
export const remainingAPlus = async (userId: string) => {
    const used = await Grade.countDocuments({ from: userId, value: 'A+', createdAt: { $gte: startOfToday() } });
    return Math.max(0, DAILY_A_PLUS_CAP - used);
};

// Los ids con los que el usuario tiene un bloqueo, en cualquiera de los dos sentidos: ni los que ha
// bloqueado el ni los que lo han bloqueado a el le salen en La Orla
const blockedWith = async (userId: string) => {
    const blocks = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] }).select('blocker blocked');

    return blocks.map((block) => (String(block.blocker) === userId ? String(block.blocked) : String(block.blocker)));
};

// El siguiente Expediente para votar: un estudiante activo (el prehook ya quita inactivos y archivados),
// que no soy yo, al que no he votado y sin bloqueo entre los dos. Devuelve tambien cuantos A+ me quedan,
// para que la pantalla no tenga que pedirlo aparte. Si no queda nadie, user es null.
export const getNext = async (userId: string) => {
    const [votedIds, blockedIds, remaining] = await Promise.all([
        // A quienes ya he votado (A+ o F): no vuelven a salir
        Grade.find({ from: userId }).distinct('to'),
        blockedWith(userId),
        remainingAPlus(userId)
    ]);

    // Me excluyo yo y excluyo a los ya votados y a los bloqueados
    const excluded = [userId, ...votedIds.map(String), ...blockedIds];

    const user = await User.findOne({ role: 'user', _id: { $nin: excluded } })
        .select(EXPEDIENTE_FIELDS)
        .sort({ createdAt: 1 });

    return { user, remaining };
};

// Lo que puede salir mal al votar. El controlador lo traduce a un codigo HTTP
export type VoteError = 'same-user' | 'not-found' | 'blocked' | 'already-voted' | 'cap-reached';

// Votar un Expediente como estudiante. "from" es quien vota (sale del token), "to" a quien.
// Comprueba, por orden: que no me voto a mi mismo, que el otro existe y es estudiante, que no hay
// bloqueo entre los dos, que no lo habia votado ya y, si es A+, que no he agotado el cupo del dia.
// Si es A+ y el otro ya me habia dado A+, se abre el Date con el sorteo del turno (openDateIfMutual).
export const vote = async (from: string, to: string, value: GradeValue) => {
    if (from === to) {
        return { error: 'same-user' as const };
    }

    // findById pasa por el prehook: un usuario inactivo o archivado no se encuentra (no se puede votar)
    const target = await User.findById(to);

    if (!target || target.role !== 'user') {
        return { error: 'not-found' as const };
    }

    const block = await Block.findOne({ $or: [{ blocker: from, blocked: to }, { blocker: to, blocked: from }] });

    if (block) {
        return { error: 'blocked' as const };
    }

    const existing = await Grade.findOne({ from, to });

    if (existing) {
        return { error: 'already-voted' as const };
    }

    // El cupo solo afecta a los A+. Las F no se cuentan ni se limitan
    if (value === 'A+' && (await remainingAPlus(from)) <= 0) {
        return { error: 'cap-reached' as const };
    }

    const grade = await Grade.create({ from, to, value });

    // El "match": si es A+ y el otro ya me habia dado A+, se abre el Date (openDateIfMutual sortea el
    // turno y escribe el primer evento del history). Devuelve el Date o null
    const date = value === 'A+' ? await openDateIfMutual(from, to) : null;

    return { grade, date, remaining: await remainingAPlus(from) };
};

// Lo que puede salir mal al deshacer
export type UndoError = 'not-found' | 'too-late';

// Deshacer un voto propio dentro de los 10 segundos. Si ese A+ habia abierto un Date, el Date se borra
// tambien (con su Plan y sus mensajes, que casi nunca existiran en 10 s). Si han pasado los 10 s, 409.
// Solo se puede deshacer un voto propio: el de otro devuelve 404, para no dejar adivinar votos ajenos.
export const undo = async (gradeId: string, userId: string) => {
    const grade = await Grade.findById(gradeId);

    if (!grade || String(grade.from) !== userId) {
        return { error: 'not-found' as const };
    }

    const createdAt = grade.get('createdAt') as Date;

    if (Date.now() - createdAt.getTime() > UNDO_WINDOW_MS) {
        return { error: 'too-late' as const };
    }

    // Si era un A+, pudo abrir un Date con la otra persona. Al quitar mi A+ ya no hay A+ mutuo, asi que
    // ese Date no debe seguir existiendo
    let dateRemoved = false;

    if (grade.value === 'A+') {
        const date = await DateModel.findOne({ users: { $all: [String(grade.from), String(grade.to)] } });

        if (date) {
            await deleteDate(String(date._id));
            dateRemoved = true;
        }
    }

    await grade.deleteOne();

    return { dateRemoved, remaining: await remainingAPlus(userId) };
};

export default { getNext, vote, undo, remainingAPlus, DAILY_A_PLUS_CAP, UNDO_WINDOW_MS };
