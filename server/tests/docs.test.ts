import request from 'supertest';
import app from '../src/app';
import { ROUTES } from '../src/docs/openapi';
import { registeredRoutes } from './routeRegistry';

describe('API docs (2.4)', () => {
  it('documents every registered route and nothing else', () => {
    const documented = ROUTES.map((r) => `${r.method.toUpperCase()} /api/v1${r.path}`).sort();
    const registered = registeredRoutes().sort();
    expect(registered.filter((r) => !documented.includes(r))).toEqual([]);
    expect(documented.filter((d) => !registered.includes(d))).toEqual([]);
  });

  it('serves the OpenAPI JSON with request bodies generated from the validators', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const register = res.body.paths['/auth/register'].post;
    expect(register.requestBody.content['application/json'].schema.properties.role.enum).toEqual(['freelancer', 'client']);
    expect(res.body.paths['/gigs/{id}'].get.parameters[0]).toMatchObject({ name: 'id', in: 'path' });
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
