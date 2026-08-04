import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const notificationRouter = Router();
const dynamo = new DynamoDBService();

notificationRouter.post('/', async (req, res, next) => {
  try {
    const notification = await dynamo.put({
      PK: `USER#${req.user.id}`,
      SK: `NOTIF#${uuidv4()}`,
      id: uuidv4(),
      type: req.body.type || 'generic',
      message: req.body.message || 'New notification',
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const updated = await dynamo.update(`USER#${req.user.id}`, `NOTIF#${req.params.id}`, { read: true });
    res.json({ notification: updated });
  } catch (error) {
    next(error);
  }
});

notificationRouter.delete('/:id', async (req, res, next) => {
  try {
    await dynamo.delete(`USER#${req.user.id}`, `NOTIF#${req.params.id}`);
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

notificationRouter.get('/', async (req, res, next) => {
  try {
    const result = await dynamo.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${req.user.id}`, ':sk': 'NOTIF#' },
      Limit: 20,
    });
    res.json({ notifications: result.items });
  } catch (error) {
    next(error);
  }
});
