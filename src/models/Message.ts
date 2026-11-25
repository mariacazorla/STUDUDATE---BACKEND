import mongoose, { Document, Schema } from 'mongoose';

// Longitud maxima de un mensaje del chat
export const MESSAGE_MAX_LENGTH = 1000;

// Un mensaje del chat de un Date. Se envia por socket.io y se guarda aqui para que, al volver a abrir
// el Date, se vea la conversacion. El primer mensaje pasa el Date a "En curso".
export interface IMessage {
    // El Date al que pertenece el mensaje: cada Date es una sala del chat
    date: mongoose.Types.ObjectId | string;

    // Quien lo ha escrito (uno de los dos usuarios del Date)
    from: mongoose.Types.ObjectId | string;

    text: string;

    // Cuando lo ha leido la otra persona. Sin fecha: todavia no lo ha leido
    readAt?: Date;
}

// Esta interfaz junta los datos del mensaje con las propiedades de un documento de MongoDB.
// createdAt lo pone Mongoose (timestamps) y es la hora del mensaje
export interface IMessageModel extends IMessage, Document {
    createdAt: Date;
}

const MessageSchema: Schema = new Schema(
    {
        // Referencias a los modelos Date y User, igual que from y to en los votos
        date: { type: Schema.Types.ObjectId, ref: 'Date', required: true },

        from: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        text: { type: String, required: true, trim: true, maxlength: MESSAGE_MAX_LENGTH },

        readAt: { type: Date }
    },
    {
        // Un mensaje no se edita: solo guardamos cuando se creo
        timestamps: { createdAt: true, updatedAt: false },

        versionKey: false
    }
);

// El chat siempre pide los mensajes de un Date ordenados por fecha. Con este indice compuesto MongoDB
// va directo a los de ese Date y ya los tiene en orden, sin recorrer los mensajes de todos los chats
MessageSchema.index({ date: 1, createdAt: 1 });

export default mongoose.model<IMessageModel>('Message', MessageSchema);
