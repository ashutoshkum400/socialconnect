import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const postRouter = Router();
const dynamo = new DynamoDBService();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

postRouter.post('/', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const id = uuidv4();
    const post = await dynamo.put({
      PK: `POST#${id}`,
      SK: 'POST',
      id,
      type: 'post',
      authorId: req.user.id,
      content: req.body.content,
      hashtags: req.body.hashtags || [],
      mentions: req.body.mentions || [],
      likes: 0,
      shares: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI2PK: `USER#${req.user.id}`,
      GSI2SK: `POST#${id}`,
    });
    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
});

postRouter.put('/:id', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`POST#${req.params.id}`, 'POST', { content: req.body.content });
    res.json({ post: updated });
  } catch (error) {
    next(error);
  }
});

postRouter.delete('/:id', async (req, res, next) => {
  try {
    await dynamo.delete(`POST#${req.params.id}`, 'POST');
    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

postRouter.get('/feed', async (_req, res, next) => {
  try {
    const result = await dynamo.query({
      IndexName: 'GSI4',
      KeyConditionExpression: 'GSI4PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST' },
      Limit: 20,
    });
    res.json({ posts: result.items });
  } catch (error) {
    next(error);
  }
});

postRouter.get('/user/:userId', async (req, res, next) => {
  try {
    const result = await dynamo.query({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${req.params.userId}`, ':sk': 'POST#' },
      Limit: 20,
    });
    res.json({ posts: result.items });
  } catch (error) {
    next(error);
  }
});

postRouter.post('/:id/like', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `POST#${req.params.id}`, SK: `LIKE#${req.user.id}`, id: uuidv4(), type: 'like', userId: req.user.id, createdAt: new Date().toISOString() });
    res.json({ message: 'Liked' });
  } catch (error) {
    next(error);
  }
});

postRouter.delete('/:id/like', async (req, res, next) => {
  try {
    await dynamo.delete(`POST#${req.params.id}`, `LIKE#${req.user.id}`);
    res.json({ message: 'Unliked' });
  } catch (error) {
    next(error);
  }
});

postRouter.post('/:id/save', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `USER#${req.user.id}`, SK: `SAVE#${req.params.id}`, id: uuidv4(), type: 'save', postId: req.params.id, createdAt: new Date().toISOString() });
    res.json({ message: 'Saved' });
  } catch (error) {
    next(error);
  }
});

postRouter.delete('/:id/save', async (req, res, next) => {
  try {
    await dynamo.delete(`USER#${req.user.id}`, `SAVE#${req.params.id}`);
    res.json({ message: 'Unsaved' });
  } catch (error) {
    next(error);
  }
});

postRouter.post('/:id/share', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `POST#${req.params.id}`, SK: `SHARE#${req.user.id}`, id: uuidv4(), type: 'share', userId: req.user.id, createdAt: new Date().toISOString() });
    res.json({ message: 'Shared' });
  } catch (error) {
    next(error);
  }
});
