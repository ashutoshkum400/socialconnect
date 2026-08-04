import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const friendRequestRouter = Router();
const dynamo = new DynamoDBService();

friendRequestRouter.post('/request/:targetId', async (req, res, next) => {
  try {
    const request = await dynamo.put({
      PK: `FRIEND#${req.params.targetId}`,
      SK: `REQUEST#${req.user.id}`,
      id: uuidv4(),
      type: 'friend-request',
      fromId: req.user.id,
      toId: req.params.targetId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
});

friendRequestRouter.post('/accept/:requestId', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`FRIEND#${req.params.requestId}`, `REQUEST#${req.user.id}`, { status: 'accepted' });
    res.json({ request: updated });
  } catch (error) {
    next(error);
  }
});

friendRequestRouter.post('/reject/:requestId', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`FRIEND#${req.params.requestId}`, `REQUEST#${req.user.id}`, { status: 'rejected' });
    res.json({ request: updated });
  } catch (error) {
    next(error);
  }
});

friendRequestRouter.delete('/cancel/:targetId', async (req, res, next) => {
  try {
    await dynamo.delete(`FRIEND#${req.params.targetId}`, `REQUEST#${req.user.id}`);
    res.json({ message: 'Friend request cancelled' });
  } catch (error) {
    next(error);
  }
});
