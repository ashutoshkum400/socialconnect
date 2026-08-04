import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const userRouter = Router();
const dynamo = new DynamoDBService();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

userRouter.get('/me', async (req, res, next) => {
  try {
    const profile = await dynamo.query({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
      ExpressionAttributeValues: { ':pk': `USER#${req.user.id}`, ':sk': 'PROFILE' },
    });
    res.json({ user: profile.items[0] || null });
  } catch (error) {
    next(error);
  }
});

userRouter.put('/me', [body('name').optional().isString(), body('bio').optional().isString()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const updated = await dynamo.update(`USER#${req.user.id}`, 'PROFILE', req.body);
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/search', [query('q').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const queryText = req.query.q.toLowerCase();
    const result = await dynamo.query({
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': 'USER' },
      Limit: 20,
    });
    const filtered = result.items.filter((item) => item.username?.includes(queryText) || item.name?.toLowerCase().includes(queryText));
    res.json({ users: filtered });
  } catch (error) {
    next(error);
  }
});

userRouter.post('/follow/:targetId', async (req, res, next) => {
  try {
    const relationId = uuidv4();
    await dynamo.put({ PK: `REL#${req.user.id}`, SK: `FOLLOW#${req.params.targetId}`, id: relationId, type: 'follow', targetId: req.params.targetId, createdAt: new Date().toISOString() });
    res.json({ message: 'Followed successfully' });
  } catch (error) {
    next(error);
  }
});

userRouter.delete('/follow/:targetId', async (req, res, next) => {
  try {
    await dynamo.delete(`REL#${req.user.id}`, `FOLLOW#${req.params.targetId}`);
    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    next(error);
  }
});

userRouter.post('/block/:targetId', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `REL#${req.user.id}`, SK: `BLOCK#${req.params.targetId}`, id: uuidv4(), type: 'block', targetId: req.params.targetId, createdAt: new Date().toISOString() });
    res.json({ message: 'Blocked successfully' });
  } catch (error) {
    next(error);
  }
});

userRouter.delete('/block/:targetId', async (req, res, next) => {
  try {
    await dynamo.delete(`REL#${req.user.id}`, `BLOCK#${req.params.targetId}`);
    res.json({ message: 'Unblocked successfully' });
  } catch (error) {
    next(error);
  }
});

userRouter.put('/privacy', [body('privacy').optional().isIn(['public', 'private', 'friends'])], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const updated = await dynamo.update(`USER#${req.user.id}`, 'PROFILE', { privacy: req.body.privacy });
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});
