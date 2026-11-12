const mongoose = require('mongoose');

const groupGoalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: ''
    },
    unit: {
      type: String,
      required: [true, 'Measurement unit is required'],
      trim: true,
      maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    targetValue: {
      type: Number,
      required: [true, 'Target value is required'],
      min: [1, 'Target must be at least 1']
    },
    currentProgress: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupGoal', groupGoalSchema);