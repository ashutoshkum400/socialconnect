import { DynamoDBService } from '../services/dynamodb.service.mjs';
import { migrateSupabaseUsersToDynamo, rollbackSupabaseMigration } from '../services/supabase-migration.service.mjs';

const action = process.argv[2] || 'import';
const dynamo = new DynamoDBService();

async function main() {
  await dynamo.initialize();
  if (action === 'rollback') {
    await rollbackSupabaseMigration(dynamo);
    console.log('Rollback completed');
    return;
  }
  const migrated = await migrateSupabaseUsersToDynamo(dynamo);
  console.log(`Imported ${migrated.length} users into DynamoDB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
