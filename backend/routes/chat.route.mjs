import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const chatRouter = Router();
const dynamo = new DynamoDBService();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

chatRouter.post('/thread/:targetId/message', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const message = await dynamo.put({
      PK: `CHAT#${[req.user.id, req.params.targetId].sort().join(':')}`,
      SK: `MSG#${uuidv4()}`,
      id: uuidv4(),
      type: 'message',
      senderId: req.user.id,
      recipientId: req.params.targetId,
      content: req.body.content,
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

chatRouter.put('/thread/:threadId/message/:messageId', [body('content').notEmpty()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    const updated = await dynamo.update(`CHAT#${req.params.threadId}`, `MSG#${req.params.messageId}`, { content: req.body.content });
    res.json({ message: updated });
  } catch (error) {
    next(error);
  }
});

chatRouter.delete('/thread/:threadId/message/:messageId', async (req, res, next) => {
  try {
    await dynamo.delete(`CHAT#${req.params.threadId}`, `MSG#${req.params.messageId}`);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/thread/:threadId/read', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`CHAT#${req.params.threadId}`, 'READ', { read: true });
    res.json({ message: updated });
  } catch (error) {
    next(error);
  }
});
