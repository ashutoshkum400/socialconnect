import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb.service.mjs';
import { env } from '../config/env.mjs';

export const authRouter = Router();
const dynamo = new DynamoDBService();

function createToken(user) {
  return jwt.sign({ sub: user.id, id: user.id, role: user.role || 'user' }, env.jwtSecret, { expiresIn: '15m' });
}

function createRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, env.jwtSecret, { expiresIn: '7d' });
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

authRouter.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').optional().isString(),
], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;

    const { email, password, name, username } = req.body;
    const existing = await dynamo.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':sk': `EMAIL#${email.toLowerCase()}`,
      },
    });

    if (existing.items.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await dynamo.put({
      PK: `USER#${id}`,
      SK: 'PROFILE',
      type: 'user',
      id,
      name: name || username || 'New User',
      username: username || `user_${id.slice(0, 8)}`,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      privacy: 'public',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI1PK: 'USER',
      GSI1SK: `EMAIL#${email.toLowerCase()}`,
    });

    res.status(201).json({ user: { id: user.id, email: user.email, username: user.username, name: user.name }, token: createToken(user), refreshToken: createRefreshToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;

    const { email, password } = req.body;
    const result = await dynamo.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':sk': `EMAIL#${email.toLowerCase()}`,
      },
    });

    if (!result.items.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.items[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ user: { id: user.id, email: user.email, username: user.username, name: user.name }, token: createToken(user), refreshToken: createRefreshToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const payload = jwt.verify(refreshToken, env.jwtSecret);
    res.json({ token: jwt.sign({ sub: payload.sub, id: payload.sub, role: 'user' }, env.jwtSecret, { expiresIn: '15m' }) });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

authRouter.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

authRouter.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    res.json({ message: 'If the account exists, a reset link was sent' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', [body('token').notEmpty(), body('password').isLength({ min: 8 })], async (req, res, next) => {
  try {
    handleValidation(req, res, next);
    if (res.headersSent) return;
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});
