import dotenv from 'dotenv';

dotenv.config();

export const env = {
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  tableName: process.env.TABLE_NAME || 'Sathi',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  port: Number(process.env.PORT || 3001),
};
