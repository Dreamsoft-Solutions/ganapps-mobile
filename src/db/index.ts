import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const expoDb = openDatabaseSync('app.db');

export const db = drizzle(expoDb);
