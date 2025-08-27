import mongoose from 'mongoose';
import crypto from 'crypto';

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  }
}, { _id: false });

const bidSchema = new mongoose.Schema({
  portal: {
    type: String,
    enum: ['SEPTA'],
    required: true,
    index: true
  },
  externalId: {
    type: String,
    sparse: true,
    index: true
  },
  link: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  postedDate: {
    type: Date,
    required: true,
    index: true
  },
  dueDate: {
    type: Date,
    index: true
  },
  quantity: {
    type: String
  },
  description: {
    type: String
  },
  documents: [documentSchema],
  titleHash: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for deduplication
bidSchema.index({ portal: 1, titleHash: 1 }, { unique: true });

// Index for efficient querying
bidSchema.index({ portal: 1, postedDate: -1 });
bidSchema.index({ portal: 1, dueDate: 1 });

// Pre-save middleware to ensure titleHash is set
bidSchema.pre('save', function(next) {
  if (!this.titleHash && this.title) {
    this.titleHash = crypto.createHash('sha256').update(this.title).digest('hex');
  }
  next();
});

const Bid = mongoose.model('Bid', bidSchema);

export default Bid;