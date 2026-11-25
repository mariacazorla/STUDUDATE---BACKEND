import mongoose, { Document, Schema } from 'mongoose';

// Motivos por los que se puede mandar un parte:
//   harassment     acoso
//   fake_profile   perfil falso
//   inappropriate  contenido inapropiado
//   other          otro (se explica en el comentario)
export const REPORT_REASONS = ['harassment', 'fake_profile', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// Estados de un parte:
//   open       abierto: nadie lo ha mirado todavia
//   reviewed   revisado: un admin lo ha mirado y ha anotado lo que ha hecho
//   dismissed  descartado: un admin lo ha mirado y no habia motivo
export const REPORT_STATUSES = ['open', 'reviewed', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Gravedad de un parte. La pone el admin al revisarlo, no quien lo manda
export const REPORT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

// Un parte: un usuario avisa de que otro se ha portado mal. Solo lo ven los admin, en el backoffice.
// De momento no hay nada automatico: el admin lo revisa y decide que hacer segun la gravedad.
export interface IReport {
    // Quien manda el parte
    reporter: mongoose.Types.ObjectId | string;

    // Sobre quien es
    reported: mongoose.Types.ObjectId | string;

    // El Date en el que paso, si el parte se manda desde un chat
    date?: mongoose.Types.ObjectId | string;

    reason: ReportReason;

    // Comentario de quien manda el parte
    text?: string;

    status: ReportStatus;

    // ---- Lo que rellena el admin al revisarlo ----

    severity?: ReportSeverity;

    // Lo que ha hecho el admin, por ejemplo "Cuenta desactivada"
    resolution?: string;

    // Que admin lo reviso y cuando
    reviewedBy?: mongoose.Types.ObjectId | string;

    reviewedAt?: Date;
}

// Esta interfaz junta los datos del parte con las propiedades de un documento de MongoDB
export interface IReportModel extends IReport, Document {}

const ReportSchema: Schema = new Schema(
    {
        reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        reported: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        date: { type: Schema.Types.ObjectId, ref: 'Date' },

        reason: { type: String, enum: REPORT_REASONS, required: true },

        text: { type: String, trim: true, maxlength: 500 },

        // Al crearse, un parte esta abierto
        status: { type: String, enum: REPORT_STATUSES, default: 'open' },

        severity: { type: String, enum: REPORT_SEVERITIES },

        resolution: { type: String, trim: true, maxlength: 500 },

        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },

        reviewedAt: { type: Date }
    },
    {
        timestamps: true,

        versionKey: false
    }
);

export default mongoose.model<IReportModel>('Report', ReportSchema);
