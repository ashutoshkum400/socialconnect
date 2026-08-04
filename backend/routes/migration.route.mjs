import { Router } from 'express';
import { authenticate } from '../middleware/auth.mjs';
import { DynamoDBService } from '../services/dynamodb.service.mjs';
import { exportSupabaseUsers, migrateSupabaseUsersToDynamo, rollbackSupabaseMigration } from '../services/supabase-migration.service.mjs';

export const migrationRouter = Router();
const dynamo = new DynamoDBService();

migrationRouter.get('/export', authenticate, async (_req, res, next) => {
  try {
    const users = await exportSupabaseUsers();
    res.json({ count: users.length, users });
  } catch (error) {
    next(error);
  }
});

migrationRouter.post('/import', authenticate, async (_req, res, next) => {
  try {
    const migrated = await migrateSupabaseUsersToDynamo(dynamo);
    res.json({ message: 'Migration completed', count: migrated.length });
  } catch (error) {
    next(error);
  }
});

migrationRouter.post('/rollback', authenticate, async (_req, res, next) => {
  try {
    await rollbackSupabaseMigration(dynamo);
    res.json({ message: 'Rollback completed' });
  } catch (error) {
    next(error);
  }
});
