import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateDevicePushToken, updateDevicePushPermission, updateDeviceWidgetAdded, getDeviceById } from '../services/database';

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
}