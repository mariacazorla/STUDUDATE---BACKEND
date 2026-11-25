import mongoose, { Document, Schema } from 'mongoose';

// Un bloqueo: un usuario decide que no quiere volver a ver a otro. A partir de ahi ninguno de los dos
// le sale al otro en La Orla ni en los chats. A la persona bloqueada no se le avisa.
export interface IBlock {
    // Quien bloquea
    blocker: mongoose.Types.ObjectId | string;

    // A quien bloquea
    blocked: mongoose.Types.ObjectId | string;
}

// Esta interfaz junta los datos del bloqueo con las propiedades de un documento de MongoDB
export interface IBlockModel extends IBlock, Document {
    createdAt: Date;
}

const BlockSchema: Schema = new Schema(
    {
        blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true }
    },
    {
        // Un bloqueo no se edita (se quita borrandolo): solo guardamos cuando se hizo
        timestamps: { createdAt: true, updatedAt: false },

        versionKey: false
    }
);

// Un usuario solo puede bloquear una vez a cada persona: la pareja (blocker, blocked) no se repite.
// Si se intenta, MongoDB lanza un error 11000 y el ErrorHandler responde 409.
// Como en los votos, el bloqueo de A a B y el de B a A son parejas distintas.
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export default mongoose.model<IBlockModel>('Block', BlockSchema);
