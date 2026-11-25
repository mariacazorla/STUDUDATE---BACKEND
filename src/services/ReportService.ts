import type { ReportListQuery } from '../middleware/Joi';
import DateModel from '../models/Date';
import Report, { ReportReason, ReportSeverity } from '../models/Report';
import User, { AuthUser } from '../models/User';

// Los partes: un estudiante avisa de que otro se ha portado mal. Solo los ven los admin, en el
// backoffice, que les ponen la gravedad y anotan lo que han hecho. De momento no hay nada automatico:
// el admin revisa y decide. Quien manda el parte sale siempre del token.

// Como en los Dates: los dos usuarios del parte llegan con su nombre, email y foto, tambien si estan
// inactivos (un parte puede acabar con la cuenta desactivada y el admin tiene que seguir viendo quien era)
const POPULATE_USERS = [
    { path: 'reporter', select: 'name email photo', options: { withInactive: true } },
    { path: 'reported', select: 'name email photo', options: { withInactive: true } }
];

// Lo que puede salir mal al mandar un parte. El controlador lo traduce a un codigo HTTP
export type ReportError = 'same-user' | 'not-found' | 'date-not-yours';

// Lo que manda el estudiante
export interface NewReport {
    reported: string;
    date?: string;
    reason: ReportReason;
    text?: string;
}

// Funcion que crea un parte.
//   - No se puede mandar un parte sobre uno mismo (422)
//   - La persona tiene que existir (404); se busca con withInactive porque un parte sobre alguien que
//     ya esta desactivado sigue teniendo sentido para el admin
//   - Si se manda desde un chat, el Date tiene que ser mio y de esa persona (422): nadie puede colgar un
//     parte de un Date ajeno
export const createReport = async (reporterId: string, data: NewReport) => {
    if (reporterId === data.reported) {
        return { error: 'same-user' as const };
    }

    const target = await User.findById(data.reported).setOptions({ withInactive: true });

    if (!target) {
        return { error: 'not-found' as const };
    }

    if (data.date) {
        const date = await DateModel.findOne({ _id: data.date, users: { $all: [reporterId, data.reported] } });

        if (!date) {
            return { error: 'date-not-yours' as const };
        }
    }

    const created = await Report.create({ reporter: reporterId, reported: data.reported, date: data.date, reason: data.reason, text: data.text });

    return { report: await created.populate(POPULATE_USERS) };
};

// Funcion que busca una pagina de partes para el backoffice, primero los mas nuevos. Se puede filtrar
// por estado (los abiertos son los que hay que mirar), por gravedad y por la persona de la que es el parte
export const getReports = async ({ page, limit, status, severity, reported }: ReportListQuery) => {
    const filter = {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(reported ? { reported } : {})
    };

    const [reports, total] = await Promise.all([
        Report.find(filter)
            .populate(POPULATE_USERS)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Report.countDocuments(filter)
    ]);

    return {
        reports,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
};

// Funcion que busca un parte por su id (solo admin)
export const getReportById = (reportId: string) => {
    return Report.findById(reportId).populate(POPULATE_USERS);
};

// Lo que rellena el admin al revisar un parte
export interface ReportReview {
    status: 'reviewed' | 'dismissed';
    severity?: ReportSeverity;
    resolution?: string;
}

// Funcion que revisa un parte: lo deja como revisado o descartado, con la gravedad y lo que se ha hecho,
// y apunta que admin lo reviso y cuando. Un parte se puede volver a revisar (para cambiar la gravedad o
// añadir lo que se ha hecho despues): se sobreescribe quien y cuando. Devuelve null si no existe (404)
export const reviewReport = async (reportId: string, admin: AuthUser, review: ReportReview) => {
    return Report.findByIdAndUpdate(
        reportId,
        { status: review.status, severity: review.severity, resolution: review.resolution, reviewedBy: admin.id, reviewedAt: new Date() },
        { new: true, runValidators: true }
    ).populate(POPULATE_USERS);
};

export default { createReport, getReports, getReportById, reviewReport };
