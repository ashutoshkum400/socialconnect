import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const commentRouter = Router();
const dynamo = new DynamoDBService();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

commentRouter.post('/:postId', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const comment = await dynamo.put({
      PK: `POST#${req.params.postId}`,
      SK: `COMMENT#${uuidv4()}`,
      id: uuidv4(),
      type: 'comment',
      postId: req.params.postId,
      authorId: req.user.id,
      content: req.body.content,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

commentRouter.put('/:postId/:commentId', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const updated = await dynamo.update(`POST#${req.params.postId}`, `COMMENT#${req.params.commentId}`, { content: req.body.content });
    res.json({ comment: updated });
  } catch (error) {
    next(error);
  }
});

commentRouter.delete('/:postId/:commentId', async (req, res, next) => {
  try {
    await dynamo.delete(`POST#${req.params.postId}`, `COMMENT#${req.params.commentId}`);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
});

commentRouter.post('/:postId/:commentId/reply', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const reply = await dynamo.put({
      PK: `POST#${req.params.postId}`,
      SK: `REPLY#${uuidv4()}`,
      id: uuidv4(),
      parentCommentId: req.params.commentId,
      type: 'reply',
      authorId: req.user.id,
      content: req.body.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ reply });
  } catch (error) {
    next(error);
  }
});

commentRouter.post('/:postId/:commentId/like', async (req, res, next) => {
  try {
    await dynamo.put({ PK: `POST#${req.params.postId}`, SK: `COMMENTLIKE#${req.user.id}`, id: uuidv4(), type: 'comment-like', commentId: req.params.commentId, createdAt: new Date().toISOString() });
    res.json({ message: 'Comment liked' });
  } catch (error) {
    next(error);
  }
});
