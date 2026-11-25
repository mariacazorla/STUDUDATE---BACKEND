import mongoose, { Document, Schema } from 'mongoose';

// Tipos de alerta. De momento solo hay uno, el boton de ayuda:
//   sos  el usuario ha pulsado el boton de ayuda
export const ALERT_TYPES = ['sos'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

// Estados de una alerta:
//   open         abierta: nadie la ha atendido todavia
//   attended     atendida: un admin se ha ocupado
//   false_alarm  falsa alarma: un admin la ha mirado y no pasaba nada
export const ALERT_STATUSES = ['open', 'attended', 'false_alarm'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

// Una alerta de seguridad: el boton de ayuda que un usuario pulsa durante un Date. Avisa al momento a los
// admin y, si el usuario los tiene, a sus contactos de confianza. Queda guardado quien la atendio y cuando.
export interface ISafetyAlert {
    // Quien pide ayuda
    user: mongoose.Types.ObjectId | string;

    // Desde que Date o desde que Plan se ha pedido, para saber con quien estaba
    date?: mongoose.Types.ObjectId | string;

    plan?: mongoose.Types.ObjectId | string;

    type: AlertType;

    // Unas palabras opcionales de quien pide ayuda
    message?: string;

    status: AlertStatus;

    // Que admin la atendio y cuando
    attendedBy?: mongoose.Types.ObjectId | string;

    attendedAt?: Date;
}

// Esta interfaz junta los datos de la alerta con las propiedades de un documento de MongoDB
export interface ISafetyAlertModel extends ISafetyAlert, Document {}

const SafetyAlertSchema: Schema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        date: { type: Schema.Types.ObjectId, ref: 'Date' },

        plan: { type: Schema.Types.ObjectId, ref: 'Plan' },

        type: { type: String, enum: ALERT_TYPES, default: 'sos' },

        message: { type: String, trim: true, maxlength: 300 },

        // Al crearse, una alerta esta abierta
        status: { type: String, enum: ALERT_STATUSES, default: 'open' },

        attendedBy: { type: Schema.Types.ObjectId, ref: 'User' },

        attendedAt: { type: Date }
    },
    {
        timestamps: true,

        versionKey: false
    }
);

export default mongoose.model<ISafetyAlertModel>('SafetyAlert', SafetyAlertSchema);
