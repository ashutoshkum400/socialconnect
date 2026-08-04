import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.mjs';

export class DynamoDBService {
  constructor() {
    this.client = new DynamoDBClient({
      region: env.awsRegion,
      credentials: env.awsAccessKeyId && env.awsSecretAccessKey
        ? { accessKeyId: env.awsAccessKeyId, secretAccessKey: env.awsSecretAccessKey }
        : undefined,
    });
    this.docClient = DynamoDBDocumentClient.from(this.client);
    this.tableName = env.tableName;
    this.useInMemory = !env.awsAccessKeyId || !env.awsSecretAccessKey;
    this.memoryStore = new Map();
  }

  async initialize() {
    if (this.useInMemory) {
      console.warn('AWS credentials not configured; running in development mode with in-memory fallbacks.');
      return;
    }
    try {
      await this.docClient.send(new GetCommand({ TableName: this.tableName, Key: { PK: 'health', SK: 'health' } }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.warn(`DynamoDB table ${this.tableName} was not found. Create it before running migrations or imports.`);
        return;
      }
      throw error;
    }
  }

  async put(item) {
    const record = { ...item, id: item.id || uuidv4(), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (this.useInMemory) {
      this.memoryStore.set(`${record.PK}#${record.SK}`, record);
      return record;
    }
    await this.docClient.send(new PutCommand({ TableName: this.tableName, Item: record }));
    return record;
  }

  async get(pk, sk) {
    if (this.useInMemory) {
      return this.memoryStore.get(`${pk}#${sk}`) || null;
    }
    const result = await this.docClient.send(new GetCommand({ TableName: this.tableName, Key: { PK: pk, SK: sk } }));
    return result.Item || null;
  }

  async update(pk, sk, updates) {
    if (this.useInMemory) {
      const existing = this.memoryStore.get(`${pk}#${sk}`) || { PK: pk, SK: sk };
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      this.memoryStore.set(`${pk}#${sk}`, updated);
      return updated;
    }
    const expression = [];
    const values = {};
    const names = {};

    Object.entries(updates).forEach(([key, value]) => {
      expression.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = value;
    });

    expression.push('#updatedAt = :updatedAt');
    names['#updatedAt'] = 'updatedAt';
    values[':updatedAt'] = new Date().toISOString();

    const result = await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${expression.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes || null;
  }

  async query(options) {
    if (this.useInMemory) {
      const expression = options?.KeyConditionExpression || '';
      const values = options?.ExpressionAttributeValues || {};
      const items = [...this.memoryStore.values()].filter((item) => {
        if (expression.includes('GSI1PK') && expression.includes('GSI1SK')) {
          return item.GSI1PK === values[':pk'] && item.GSI1SK === values[':sk'];
        }
        if (expression.includes('GSI2PK') && expression.includes('GSI2SK')) {
          return item.GSI2PK === values[':pk'] && item.GSI2SK === values[':sk'];
        }
        if (expression.includes('GSI3PK')) {
          return item.GSI3PK === values[':pk'];
        }
        if (expression.includes('GSI4PK')) {
          return item.GSI4PK === values[':pk'];
        }
        if (expression.includes('PK = :pk') && expression.includes('begins_with(SK, :sk)')) {
          return item.PK === values[':pk'] && String(item.SK || '').startsWith(values[':sk']);
        }
        if (expression.includes('PK = :pk')) {
          return item.PK === values[':pk'];
        }
        return true;
      });
      return { items, lastEvaluatedKey: null };
    }
    const result = await this.docClient.send(new QueryCommand({ TableName: this.tableName, ...options }));
    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey || null,
    };
  }

  async delete(pk, sk) {
    if (this.useInMemory) {
      this.memoryStore.delete(`${pk}#${sk}`);
      return;
    }
    await this.docClient.send(new DeleteCommand({ TableName: this.tableName, Key: { PK: pk, SK: sk } }));
  }

  async batchWrite(items) {
    if (this.useInMemory) {
      items.forEach((item) => this.memoryStore.set(`${item.PK}#${item.SK}`, item));
      return;
    }
    const RequestItems = {
      [this.tableName]: items.map((item) => ({ PutRequest: { Item: item } })),
    };
    await this.docClient.send(new BatchWriteCommand({ RequestItems }));
  }
}
