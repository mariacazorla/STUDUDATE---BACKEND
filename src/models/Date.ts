import mongoose, { Document, Schema } from 'mongoose';

// Ojo con el nombre: en la app esto se llama "Date" (una cita), pero Date ya es una clase de JavaScript
// (new Date() para las fechas). Si importaramos este modelo como Date, en ese fichero new Date() dejaria
// de funcionar. Por eso el modelo de Mongoose se llama 'Date' (coleccion dates), pero en el codigo se
// importa siempre como DateModel, y sus interfaces son IDate e IDateModel.

// Estados de un Date, las "bandejas" del blog:
//   pending  Pendiente: se ha abierto, pero todavia nadie ha escrito
//   ongoing  En curso: ya estan hablando
//   closed   Cerrado: se ha terminado o ha caducado
export const DATE_STATUSES = ['pending', 'ongoing', 'closed'] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];

// Por que se ha cerrado un Date:
//   expired  ha caducado sin que nadie escribiera (lo cierra el servidor)
//   blocked  uno de los dos ha bloqueado al otro
//   admin    lo ha cerrado un admin desde el backoffice
export const DATE_CLOSED_REASONS = ['expired', 'blocked', 'admin'] as const;
export type DateClosedReason = (typeof DATE_CLOSED_REASONS)[number];

// Un cambio de estado del Date. El historial es la lista de todos, del mas antiguo al mas nuevo:
// asi siempre se puede saber que le ha pasado a un Date, quien lo hizo y cuando
export interface IDateEvent {
    // El estado al que paso el Date
    status: DateStatus;

    // Quien hizo el cambio. Vacio: lo hizo el servidor (abrirlo con el A+ mutuo o cerrarlo al caducar)
    by?: mongoose.Types.ObjectId | string;

    // El motivo, si hace falta explicarlo
    reason?: string;

    // Cuando paso
    at: Date;
}

// Cuanto dura un Date antes de caducar, y cuanto añade la prorroga: 24 horas
export const DATE_DURATION_MS = 24 * 60 * 60 * 1000;

// Un Date se abre cuando dos usuarios se ponen A+ en La Orla
export interface IDate {
    // Los dos usuarios del Date
    users: mongoose.Types.ObjectId[] | string[];

    status: DateStatus;

    // A quien le toca escribir primero: se sortea al abrir el Date
    firstTurn: mongoose.Types.ObjectId | string;

    // Cuando caduca: 24 horas despues de abrirse (o 48 si se usa la prorroga)
    expiresAt: Date;

    // Si ya se ha usado la prorroga (solo hay una)
    extended: boolean;

    // Cuando paso a "En curso": la hora del primer mensaje
    startedAt?: Date;

    // Cuando se cerro y por que
    closedAt?: Date;

    closedReason?: DateClosedReason;

    // El historial: cada cambio de estado del Date
    history: IDateEvent[];
}

// Esta interfaz junta los datos del Date con las propiedades de un documento de MongoDB
export interface IDateModel extends IDate, Document {}

// Esquema de cada entrada del historial. Son subdocumentos del Date y no necesitan un _id propio:
// nunca se editan ni se borran sueltos, solo se añaden al final
const DateEventSchema = new Schema<IDateEvent>(
    {
        status: { type: String, enum: DATE_STATUSES, required: true },

        by: { type: Schema.Types.ObjectId, ref: 'User' },

        reason: { type: String, trim: true, maxlength: 200 },

        at: { type: Date, default: Date.now }
    },
    { _id: false }
);

const DateSchema: Schema = new Schema(
    {
        // Referencias al modelo User, como from y to en los votos
        users: {
            type: [Schema.Types.ObjectId],
            ref: 'User',
            required: true,
            validate: {
                validator: (users: string[]) => users.length === 2,
                message: 'Un Date es siempre entre dos usuarios'
            }
        },

        // Al abrirse, un Date esta pendiente
        status: { type: String, enum: DATE_STATUSES, default: 'pending' },

        firstTurn: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        expiresAt: { type: Date, required: true },

        extended: { type: Boolean, default: false },

        startedAt: { type: Date },

        closedAt: { type: Date },

        closedReason: { type: String, enum: DATE_CLOSED_REASONS },

        history: { type: [DateEventSchema], default: [] }
    },
    {
        timestamps: true,

        versionKey: false
    }
);

// El servidor busca cada poco los Dates que siguen pendientes y ya han caducado, para cerrarlos.
// Con este indice compuesto esa busqueda no tiene que recorrer todos los Dates
DateSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model<IDateModel>('Date', DateSchema);
