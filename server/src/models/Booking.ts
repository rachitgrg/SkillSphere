import mongoose, { Schema } from 'mongoose';
import { IBooking } from '../types';

const bookingSchema = new Schema<IBooking>(
  {
    freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gig: { type: Schema.Types.ObjectId, ref: 'Gig' },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    meetingLink: { type: String, maxlength: 500 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bookingSchema.index({ freelancer: 1, start: 1 });
bookingSchema.index({ client: 1, start: 1 });

bookingSchema.pre('validate', function () {
  if (this.end <= this.start) this.invalidate('end', 'A booking must end after it starts');
});

const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
