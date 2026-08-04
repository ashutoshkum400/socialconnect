import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { authRouter } from './routes/auth.route.mjs';
import { userRouter } from './routes/user.route.mjs';
import { postRouter } from './routes/post.route.mjs';
import { commentRouter } from './routes/comment.route.mjs';
import { friendRequestRouter } from './routes/friend-request.route.mjs';
import { notificationRouter } from './routes/notification.route.mjs';
import { reelRouter } from './routes/reel.route.mjs';
import { chatRouter } from './routes/chat.route.mjs';
import { mediaRouter } from './routes/media.route.mjs';
import { adminRouter } from './routes/admin.route.mjs';
import { migrationRouter } from './routes/migration.route.mjs';
import { errorHandler } from './middleware/error-handler.mjs';
import { authenticate } from './middleware/auth.mjs';
import { DynamoDBService } from './services/dynamodb.service.mjs';
import { seedImportedUsersIntoDynamo } from './services/user-import.service.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sathi-backend' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', authenticate, userRouter);
app.use('/api/posts', authenticate, postRouter);
app.use('/api/comments', authenticate, commentRouter);
app.use('/api/friends', authenticate, friendRequestRouter);
app.use('/api/notifications', authenticate, notificationRouter);
app.use('/api/reels', authenticate, reelRouter);
app.use('/api/chat', authenticate, chatRouter);
app.use('/api/media', authenticate, mediaRouter);
app.use('/api/admin', authenticate, adminRouter);
app.use('/api/migration', migrationRouter);

app.use(errorHandler);

const dynamodbService = new DynamoDBService();

async function startServer() {
  try {
    await dynamodbService.initialize();
    const csvPath = path.join(__dirname, '..', 'data', 'users_rows.csv');
    try {
      const importedUsers = await seedImportedUsersIntoDynamo(dynamodbService, csvPath);
      if (importedUsers.length) {
        console.log(`Imported ${importedUsers.length} users into DynamoDB for authentication`);
      }
    } catch (error) {
      console.warn('User import skipped:', error.message);
    }
    app.listen(PORT, () => {
      console.log(`🚀 Sathi backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to boot backend', error);
    process.exit(1);
  }
}

startServer();
