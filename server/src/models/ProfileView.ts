import mongoose, { Schema, Types } from 'mongoose';

export interface IProfileView {
  freelancer: Types.ObjectId;
  /** UTC midnight of the day the views happened. */
  day: Date;
  /** Unique viewers that day. */
  count: number;
  /** Viewer keys (`u:<userId>` or a hash of IP + user agent) used to dedupe; never returned by the API. */
  viewers: string[];
}

/** One document per freelancer per day: a deduplicated daily profile-view counter (plan 4.15). */
const profileViewSchema = new Schema<IProfileView>(
  {
    freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: Date, required: true },
    count: { type: Number, default: 0 },
    viewers: { type: [String], default: [], select: false },
  },
  { versionKey: false }
);

profileViewSchema.index({ freelancer: 1, day: 1 }, { unique: true });

const ProfileView = mongoose.model<IProfileView>('ProfileView', profileViewSchema);

export default ProfileView;
