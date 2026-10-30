import mongoose, { Schema, Types } from 'mongoose';

export interface IGigView {
  gig: Types.ObjectId;
  /** UTC midnight of the day the views happened. */
  day: Date;
  /** Viewer keys (`u:<userId>` or a hash of IP + user agent) already counted that day. */
  viewers: string[];
}

/**
 * Per-gig, per-day list of viewers, used only to count each viewer once a day on Gig.views
 * (P2-7). Documents expire after two days; the running total lives on the gig.
 */
const gigViewSchema = new Schema<IGigView>(
  {
    gig: { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
    day: { type: Date, required: true },
    viewers: { type: [String], default: [] },
  },
  { versionKey: false }
);

gigViewSchema.index({ gig: 1, day: 1 }, { unique: true });
gigViewSchema.index({ day: 1 }, { expireAfterSeconds: 2 * 86_400 });

const GigView = mongoose.model<IGigView>('GigView', gigViewSchema);

export default GigView;
