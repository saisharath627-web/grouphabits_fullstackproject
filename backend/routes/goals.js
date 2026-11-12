const express = require('express');
const { body, param, validationResult } = require('express-validator');
const GroupGoal = require('../models/GroupGoal');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// GET all group goals
router.get('/', async (req, res, next) => {
  try {
    const goals = await GroupGoal.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: goals });
  } catch (err) {
    next(err);
  }
});

// POST create a new group goal
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Goal title is required.').isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 300 }),
    body('unit').trim().notEmpty().withMessage('Measurement unit is required.').isLength({ max: 20 }),
    body('targetValue').isFloat({ gt: 0 }).withMessage('Target value must be a positive number.')
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, description, unit, targetValue } = req.body;
      const goal = await GroupGoal.create({
        title,
        description: description || '',
        unit,
        targetValue: Number(targetValue)
      });
      res.status(201).json({ success: true, data: goal });
    } catch (err) {
      next(err);
    }
  }
);

// GET single goal + chronological feed (masks private entries, zero public rankings)
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid goal ID.')],
  handleValidation,
  async (req, res, next) => {
    try {
      const goal = await GroupGoal.findById(req.params.id);
      if (!goal) {
        return res.status(404).json({ success: false, message: 'Group goal not found.' });
      }

      const rawLogs = await ActivityLog.find({ goalId: goal._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const safeFeed = rawLogs.map((log) => {
        if (log.isPrivate) {
          return {
            _id: log._id,
            participantName: 'Private Supporter',
            activityType: 'Movement Session',
            amount: log.amount,
            note: 'Contributed privately to the group goal',
            isPrivate: true,
            createdAt: log.createdAt
          };
        }
        return log;
      });

      res.status(200).json({
        success: true,
        data: { goal, feed: safeFeed }
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST log manual activity toward a group goal
router.post(
  '/:id/activities',
  [
    param('id').isMongoId().withMessage('Invalid goal ID.'),
    body('activityType').trim().notEmpty().withMessage('Activity type is required.').isLength({ max: 50 }),
    body('amount').isFloat({ gt: 0, max: 100000 }).withMessage('Activity amount must be greater than 0.'),
    body('isPrivate').optional().isBoolean().withMessage('Privacy flag must be a boolean.'),
    body('participantName').optional().trim().isLength({ max: 50 }),
    body('note').optional().trim().isLength({ max: 200 })
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const goal = await GroupGoal.findById(req.params.id);
      if (!goal) {
        return res.status(404).json({ success: false, message: 'Group goal not found.' });
      }

      const { participantName, activityType, amount, note, isPrivate } = req.body;
      const numericAmount = Number(amount);
      const privateEntry = Boolean(isPrivate);

      const log = await ActivityLog.create({
        goalId: goal._id,
        participantName: privateEntry ? 'Private Supporter' : (participantName || 'Anonymous Mover'),
        activityType,
        amount: numericAmount,
        note: privateEntry ? '' : (note || ''),
        isPrivate: privateEntry
      });

      goal.currentProgress = Number((goal.currentProgress + numericAmount).toFixed(2));
      await goal.save();

      res.status(201).json({
        success: true,
        data: {
          goal,
          log: privateEntry
            ? {
                _id: log._id,
                participantName: 'Private Supporter',
                activityType: 'Movement Session',
                amount: log.amount,
                note: 'Contributed privately to the group goal',
                isPrivate: true,
                createdAt: log.createdAt
              }
            : log
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;