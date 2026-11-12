const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupGoal',
      required: true,
      index: true
    },
    participantName: {
      type: String,
      trim: true,
      default: 'Anonymous Mover'
    },
    activityType: {
      type: String,
      required: [true, 'Activity type is required'],
      trim: true,
      maxlength: [50, 'Activity type cannot exceed 50 characters']
    },
    amount: {
      type: Number,
      required: [true, 'Activity amount is required'],
      min: [0.1, 'Amount must be greater than 0']
    },
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'Note cannot exceed 200 characters'],
      default: ''
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);