import mongoose, { Schema } from 'mongoose';

/**
 * Short-lived mutex documents (unique _id). Used to serialise check-then-write sections such as
 * booking conflict checks without needing a replica set for transactions. Stale locks expire.
 */
const lockSchema = new Schema({ _id: String, expiresAt: { type: Date, required: true } }, { versionKey: false });
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Lock = mongoose.model('Lock', lockSchema);

export default Lock;
