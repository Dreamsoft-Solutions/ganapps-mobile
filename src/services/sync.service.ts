import { db } from '@/db';
import { outbox } from '@/db/schema';
import { eq } from 'drizzle-orm';
import axiosInstance from '@/api/axios-instance';
import { useAuthStore } from '@/store/auth.store';

export class SyncService {
  static async enqueueOutbox(
    entityType: string,
    action: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>,
  ): Promise<void> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(outbox).values({
      id,
      entityType,
      action,
      payload: JSON.stringify(payload),
      status: 'pending',
    });
  }

  static async syncOutbox(): Promise<void> {
    const pendingItems = await db
      .select()
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .limit(10);

    for (const item of pendingItems) {
      const retries = (item.retries ?? 0) + 1;

      try {
        await SyncService.processOutboxItem(item);

        await db
          .update(outbox)
          .set({ status: 'success', updatedAt: new Date() })
          .where(eq(outbox.id, item.id));
      } catch (_error) {
        if (retries >= 3) {
          await db
            .update(outbox)
            .set({ status: 'failed', retries, updatedAt: new Date() })
            .where(eq(outbox.id, item.id));
        } else {
          await db
            .update(outbox)
            .set({ retries, updatedAt: new Date() })
            .where(eq(outbox.id, item.id));
        }
      }
    }
  }

  private static async processOutboxItem(
    item: typeof outbox.$inferSelect,
  ): Promise<void> {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const payload = JSON.parse(item.payload);

    switch (item.entityType) {
      case 'feature':
        await SyncService.syncFeature(item.action, payload);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entityType}`);
    }
  }

  private static async syncFeature(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    switch (action) {
      case 'create':
        await axiosInstance.post('/features', payload);
        break;
      case 'update':
        await axiosInstance.put(`/features/${payload.id}`, payload);
        break;
      case 'delete':
        await axiosInstance.delete(`/features/${payload.id}`);
        break;
    }
  }
}
