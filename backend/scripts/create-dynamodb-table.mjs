import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { env } from '../config/env.mjs';

const client = new DynamoDBClient({ region: env.awsRegion });

const command = new CreateTableCommand({
  TableName: env.tableName,
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
    { AttributeName: 'GSI3PK', AttributeType: 'S' },
    { AttributeName: 'GSI3SK', AttributeType: 'S' },
    { AttributeName: 'GSI4PK', AttributeType: 'S' },
    { AttributeName: 'GSI4SK', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [
    { IndexName: 'GSI1', KeySchema: [{ AttributeName: 'GSI1PK', KeyType: 'HASH' }, { AttributeName: 'GSI1SK', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
    { IndexName: 'GSI2', KeySchema: [{ AttributeName: 'GSI2PK', KeyType: 'HASH' }, { AttributeName: 'GSI2SK', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
    { IndexName: 'GSI3', KeySchema: [{ AttributeName: 'GSI3PK', KeyType: 'HASH' }, { AttributeName: 'GSI3SK', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
    { IndexName: 'GSI4', KeySchema: [{ AttributeName: 'GSI4PK', KeyType: 'HASH' }, { AttributeName: 'GSI4SK', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
  ],
});

try {
  const response = await client.send(command);
  console.log('Created DynamoDB table', response.TableDescription?.TableName);
} catch (error) {
  console.error(error);
  process.exit(1);
}
