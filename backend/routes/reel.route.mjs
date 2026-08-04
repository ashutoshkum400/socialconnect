import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const reelRouter = Router();
const dynamo = new DynamoDBService();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

reelRouter.post('/', [body('title').notEmpty(), body('videoUrl').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const reel = await dynamo.put({
      PK: `REEL#${uuidv4()}`,
      SK: 'REEL',
      id: uuidv4(),
      type: 'reel',
      authorId: req.user.id,
      title: req.body.title,
      videoUrl: req.body.videoUrl,
      views: 0,
      likes: 0,
      shares: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ reel });
  } catch (error) {
    next(error);
  }
});

reelRouter.post('/:id/like', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `REEL#${req.params.id}`, SK: `LIKE#${req.user.id}`, id: uuidv4(), type: 'reel-like', userId: req.user.id, createdAt: new Date().toISOString() });
    res.json({ message: 'Reel liked' });
  } catch (error) {
    next(error);
  }
});

reelRouter.post('/:id/comment', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const comment = await dynamo.put({ PK: `REEL#${req.params.id}`, SK: `COMMENT#${uuidv4()}`, id: uuidv4(), type: 'reel-comment', authorId: req.user.id, content: req.body.content, createdAt: new Date().toISOString() });
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

reelRouter.post('/:id/share', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `REEL#${req.params.id}`, SK: `SHARE#${req.user.id}`, id: uuidv4(), type: 'reel-share', userId: req.user.id, createdAt: new Date().toISOString() });
    res.json({ message: 'Reel shared' });
  } catch (error) {
    next(error);
  }
});

reelRouter.post('/:id/view', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`REEL#${req.params.id}`, 'REEL', { views: 1 });
    res.json({ reel: updated });
  } catch (error) {
    next(error);
  }
});
