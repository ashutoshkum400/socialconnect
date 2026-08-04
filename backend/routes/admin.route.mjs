import { Router } from 'express';
import { DynamoDBService } from '../services/dynamodb.service.mjs';

export const adminRouter = Router();
const dynamo = new DynamoDBService();

adminRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const result = await dynamo.query({ KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': 'USER' }, Limit: 20 });
    res.json({ summary: { users: result.items.length } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/reports', async (_req, res, next) => {
  try {
    res.json({ reports: [] });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/content/:id', async (req, res, next) => {
  try {
    await dynamo.delete(`POST#${req.params.id}`, 'POST');
    res.json({ message: 'Content removed' });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/moderate/:userId', async (req, res, next) => {
  try {
    await dynamo.update(`USER#${req.params.userId}`, 'PROFILE', { role: 'moderated' });
    res.json({ message: 'User moderated' });
  } catch (error) {
    next(error);
  }
});
