import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const STATUSES = ['Placed', 'Picked-up', 'In-Transit', 'Delivered', 'Cancelled'];
export const ACTIVE_STATUSES = ['Picked-up', 'In-Transit'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'agent', 'admin'], default: 'user' },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
    // Agent-only fields
    available: { type: Boolean, default: true },
    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
  },
  { timestamps: true }
);

const point = {
  address: { type: String, required: true, trim: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
};

const orderSchema = new Schema(
  {
    orderId: { type: String, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agent: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    pickup: point,
    drop: point,
    packageDescription: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    distanceKm: Number,
    status: { type: String, enum: STATUSES, default: 'Placed', index: true },
    dueAt: Date,
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.pre('validate', function (next) {
  if (!this.orderId) {
    this.orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  next();
});

const locationSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  agent: { type: Schema.Types.ObjectId, ref: 'User' },
  lat: Number,
  lng: Number,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: keep 30 days
});

const statusLogSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  status: { type: String, enum: STATUSES },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  note: String,
  createdAt: { type: Date, default: Date.now },
});

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    title: String,
    message: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);
export const Order = model('Order', orderSchema);
export const Location = model('Location', locationSchema);
export const StatusLog = model('StatusLog', statusLogSchema);
export const Notification = model('Notification', notificationSchema);
