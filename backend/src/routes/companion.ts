import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateDevicePushToken, updateDevicePushPermission, updateDeviceWidgetAdded, getDeviceById, getValentinesByPair, getPairById } from '../services/database';

const pushTokenSchema = z.object({
  device_id: z.string().uuid(),
  push_token: z.string().min(10),
});

const permissionSchema = z.object({
  device_id: z.string().uuid(),
  granted: z.boolean(),
});

const widgetSchema = z.object({
  device_id: z.string().uuid(),
  added: z.boolean(),
});

const latestValentineSchema = z.object({
  device_id: z.string().uuid(),
});

export async function companionRoutes(app: FastifyInstance) {
  app.post('/push-token', async (request, reply) => {
    const body = pushTokenSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDevicePushToken(body.device_id, body.push_token);
    return { success: true };
  });

  app.post('/permission', async (request, reply) => {
    const body = permissionSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDevicePushPermission(body.device_id, body.granted);
    return { success: true };
  });

  app.post('/widget', async (request, reply) => {
    const body = widgetSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    await updateDeviceWidgetAdded(body.device_id, body.added);
    return { success: true };
  });

  app.post('/latest-valentine', async (request, reply) => {
    const body = latestValentineSchema.parse(request.body);
    const device = await getDeviceById(body.device_id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const valentines = await getValentinesByPair(device.pair_id, 1);
    if (valentines.length === 0) {
      return { valentine: null };
    }

    const valentine = valentines[0];
    const pair = await getPairById(device.pair_id);
    const fromName =
      pair && (pair.telegram_user_a === valentine.sender_telegram_id ? pair.user_a_name : pair.user_b_name);

    return {
      valentine: {
        id: valentine.id,
        from_name: fromName,
        animation_type: valentine.animation_type,
        message: valentine.message,
        photo_url: valentine.photo_url,
        sent_at: valentine.sent_at,
      },
    };
  });
}