import mongoose from 'mongoose';
import { config } from './config/config';
import Logging from './library/Logging';
import Block from './models/Block';
import DateModel from './models/Date';
import Grade from './models/Grade';
import Message from './models/Message';
import Plan from './models/Plan';
import Report from './models/Report';
import SafetyAlert from './models/SafetyAlert';
import User from './models/User';
import { CHAT_USERS, alertsSeed, blocksSeed, gradesSeed, messagesSeed, plansSeed, reportsSeed, usersSeed } from './seed-data';
import { openDateIfMutual } from './services/DateService';

// Llena la base de datos con los datos de ejemplo de seed-data.ts.
//
//   npm run seed             inserta los datos solo si la base de datos está vacía
//   npm run seed -- --reset  borra todas las colecciones de Studate y vuelve a insertar los datos de ejemplo
//
// Siempre trabaja sobre la base de datos del .env (MONGO_URL).

const reset = process.argv.includes('--reset');

const seed = async () => {
    await mongoose.connect(config.mongo.url);
    Logging.info(`Conectado a ${config.mongo.url}`);

    if (reset) {
        // Ojo: deleteMany({}) es un borrado fisico real y a proposito.
        // El reset del seed rehace los datos desde cero, tambien los que estaban archivados.
        const users = await User.deleteMany({});
        const grades = await Grade.deleteMany({});
        const dates = await DateModel.deleteMany({});
        const plans = await Plan.deleteMany({});
        Logging.warning(
            `Borrados ${users.deletedCount} usuarios, ${grades.deletedCount} votos, ${dates.deletedCount} Dates y ${plans.deletedCount} Planes`
        );

        // Lo que cuelga de los usuarios y de los Dates: mensajes, bloqueos, partes y alertas
        const [messages, blocks, reports, alerts] = await Promise.all([
            Message.deleteMany({}),
            Block.deleteMany({}),
            Report.deleteMany({}),
            SafetyAlert.deleteMany({})
        ]);
        Logging.warning(
            `Borrados ${messages.deletedCount} mensajes, ${blocks.deletedCount} bloqueos, ${reports.deletedCount} partes y ${alerts.deletedCount} alertas`
        );
    }

    // init() crea la coleccion de cada modelo y espera a que MongoDB termine de construir sus indices.
    // Sin esto, una coleccion sin datos no existiria, y el script podria desconectarse antes de que el
    // indice este hecho. Se hace siempre, tambien si la base de datos ya tenia datos
    await Promise.all([Message.init(), Block.init(), Report.init(), SafetyAlert.init()]);

    const usersInDb = await User.countDocuments();

    if (usersInDb > 0) {
        Logging.warning('La base de datos ya tiene datos. Para rehacerla: npm run seed -- --reset');
        return;
    }

    // create() dispara los hooks del modelo: la contrasena del usuario se guarda cifrada
    const createdUsers = await User.create(usersSeed);
    Logging.info(`Usuarios creados: ${createdUsers.length}`);

    // Cada voto trae los emails de los dos usuarios; aquí se cambian por los ids que les ha dado MongoDB
    const idOf = (email: string) => {
        const user = createdUsers.find((created) => created.email === email);

        if (!user) {
            throw new Error(`En seed-data.ts hay un voto de un usuario que no existe: ${email}`);
        }

        return user._id;
    };

    const createdGrades = await Grade.insertMany(gradesSeed.map((grade) => ({ from: idOf(grade.from), to: idOf(grade.to), value: grade.value })));
    Logging.info(`Votos de La Orla creados: ${createdGrades.length}`);

    // Los Dates salen de los votos con la misma regla que usa la API: por cada A+, si ya existe el A+
    // contrario y todavia no hay Date entre los dos, se abre uno
    for (const grade of createdGrades.filter((created) => created.value === 'A+')) {
        await openDateIfMutual(String(grade.from), String(grade.to));
    }

    // Para que haya Dates en todas las bandejas, uno pasa a "En curso" (con la prorroga usada)
    // y otro a "Cerrado" (y ya caducado). Cada cambio deja su entrada en el historial del Date,
    // detras de la de "Pendiente" que ya puso createDate al abrirlo
    const dates = await DateModel.find().sort({ createdAt: 1 });
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

    if (dates.length >= 2) {
        // En curso: lo empezo, con el primer mensaje, la persona a la que le tocaba el turno
        const startedAt = minutesAgo(messagesSeed[0].minutesAgo);

        await DateModel.updateOne(
            { _id: dates[0]._id },
            {
                status: 'ongoing',
                extended: true,
                expiresAt: new Date(Date.now() + 30 * 60 * 60 * 1000),
                startedAt,
                $push: { history: { status: 'ongoing', by: dates[0].firstTurn, reason: 'Primer mensaje', at: startedAt } }
            }
        );

        // Cerrado: caduco sin que nadie escribiera, asi que lo cerro el servidor (sin autor)
        const closedAt = minutesAgo(120);

        await DateModel.updateOne(
            { _id: dates[1]._id },
            {
                status: 'closed',
                expiresAt: closedAt,
                closedAt,
                closedReason: 'expired',
                $push: { history: { status: 'closed', reason: 'Caducado sin mensajes', at: closedAt } }
            }
        );
    }

    Logging.info(`Dates abiertos: ${dates.length}`);

    // Los Planes del "Cambio de Aula": cada uno se pone en el Date de su pareja
    const atDay = (inDays: number, hour: number) => {
        const day = new Date();
        day.setDate(day.getDate() + inDays);
        day.setHours(hour, 0, 0, 0);
        return day;
    };

    for (const plan of plansSeed) {
        const pairDate = await DateModel.findOne({ users: { $all: plan.users.map(idOf) } });

        if (!pairDate) {
            throw new Error(`En seed-data.ts hay un Plan de una pareja sin Date: ${plan.users.join(' y ')}`);
        }

        await Plan.create({
            date: pairDate._id,
            status: plan.status,
            deleted: Boolean(plan.archived),
            deletedAt: plan.archived ? new Date() : undefined,
            spins: plan.spins.map(({ inDays, hour, ...spin }) => ({ ...spin, scheduledAt: atDay(inDays, hour) }))
        });
    }

    Logging.info(`Planes creados: ${plansSeed.length}`);

    // ---- Sprint 2: chat, bloqueos, partes y alertas ----

    // El Date que tienen dos usuarios, a partir de sus emails
    const dateOf = async (emailA: string, emailB: string) => {
        const pairDate = await DateModel.findOne({ users: { $all: [idOf(emailA), idOf(emailB)] } });

        if (!pairDate) {
            throw new Error(`En seed-data.ts se usa el Date de una pareja que no tiene: ${emailA} y ${emailB}`);
        }

        return pairDate;
    };

    // Los mensajes del chat del Date en curso. Empieza quien tiene el primer turno, que se sorteo al abrirlo
    const chatDate = await dateOf(...CHAT_USERS);
    const firstTurn = String(chatDate.firstTurn);
    const other = chatDate.users.map(String).find((userId) => userId !== firstTurn);

    await Message.insertMany(
        messagesSeed.map((message) => ({
            date: chatDate._id,
            from: message.fromFirstTurn ? firstTurn : other,
            text: message.text,
            createdAt: minutesAgo(message.minutesAgo)
        }))
    );
    Logging.info(`Mensajes creados: ${messagesSeed.length}`);

    await Block.insertMany(blocksSeed.map((block) => ({ blocker: idOf(block.blocker), blocked: idOf(block.blocked) })));
    Logging.info(`Bloqueos creados: ${blocksSeed.length}`);

    // Los partes revisados los firma el admin del seed
    const adminId = idOf('admin@example.com');

    for (const report of reportsSeed) {
        const reviewed = report.status !== 'open';

        await Report.create({
            reporter: idOf(report.reporter),
            reported: idOf(report.reported),
            date: report.fromDate ? (await dateOf(report.reporter, report.reported))._id : undefined,
            reason: report.reason,
            text: report.text,
            status: report.status,
            severity: report.severity,
            resolution: report.resolution,
            reviewedBy: reviewed ? adminId : undefined,
            reviewedAt: reviewed ? minutesAgo(60) : undefined
        });
    }

    Logging.info(`Partes creados: ${reportsSeed.length}`);

    for (const alert of alertsSeed) {
        const attended = alert.status !== 'open';

        await SafetyAlert.create({
            user: idOf(alert.user),
            date: (await dateOf(alert.user, alert.with))._id,
            message: alert.message,
            status: alert.status,
            attendedBy: attended ? adminId : undefined,
            attendedAt: attended ? minutesAgo(90) : undefined
        });
    }

    Logging.info(`Alertas creadas: ${alertsSeed.length}`);
};

seed()
    .catch((error) => {
        Logging.error(error);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
