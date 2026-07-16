import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LumiSign Enterprise API',
      version: '1.0.0',
      description: 'Real-Time Digital Signage Management System — REST API',
    },
    servers: [
      { url: config.serverPublicUrl, description: 'Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/auth/login': {
        post: { summary: 'Authenticate and receive JWT', tags: ['Auth'],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
          responses: { 200: { description: 'JWT token' }, 401: { description: 'Invalid credentials' } } },
      },
      '/api/devices': { get: { summary: 'List devices', tags: ['Devices'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'devices' } } } },
      '/api/devices/{id}/command': { post: { summary: 'Send control command to device', tags: ['Devices'], security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'command queued' } } } },
      '/api/media/upload': { post: { summary: 'Upload media file', tags: ['Media'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'created' } } } },
      '/api/playlists': { get: { summary: 'List playlists', tags: ['Playlists'], security: [{ bearerAuth: [] }] }, post: { summary: 'Create playlist', tags: ['Playlists'], security: [{ bearerAuth: [] }] } },
      '/api/schedules': { get: { summary: 'List schedules', tags: ['Schedules'], security: [{ bearerAuth: [] }] }, post: { summary: 'Create schedule', tags: ['Schedules'], security: [{ bearerAuth: [] }] } },
      '/api/users': { get: { summary: 'List users', tags: ['Users'], security: [{ bearerAuth: [] }] } },
      '/api/analytics/stats': { get: { summary: 'Live dashboard statistics', tags: ['Analytics'], security: [{ bearerAuth: [] }] } },
      '/api/logs': { get: { summary: 'Query logs', tags: ['Logs'], security: [{ bearerAuth: [] }] } },
      '/api/notifications': { get: { summary: 'List notifications', tags: ['Notifications'], security: [{ bearerAuth: [] }] } },
      '/api/updates': { get: { summary: 'List player updates', tags: ['Updates'], security: [{ bearerAuth: [] }] } },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
