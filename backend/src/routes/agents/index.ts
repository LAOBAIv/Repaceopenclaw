// index.ts — 路由注册（薄层，只注册 router.get/post/put/delete）
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  listAgents,
  routingOverview,
  channelOverview,
  updateChannelModel,
  getAgent,
  getTokenStats,
  createAgent,
  updateAgent,
  deleteAgent,
  syncAgents,
  registryLog,
  registryStatus,
} from './handlers';

const router = Router();

// GET /api/agents
router.get('/', authenticate, listAgents);

// GET /api/agents/routing-overview
router.get('/routing-overview', authenticate, routingOverview);

// GET /api/agents/channel-overview
router.get('/channel-overview', authenticate, channelOverview);

// PUT /api/agents/channel/:ocAgentId/model
router.put('/channel/:ocAgentId/model', authenticate, updateChannelModel);

// GET /api/agents/:id
router.get('/:id', authenticate, getAgent);

// GET /api/agents/:id/token-stats
router.get('/:id/token-stats', authenticate, getTokenStats);

// POST /api/agents
router.post('/', authenticate, createAgent);

// PUT /api/agents/:id
router.put('/:id', authenticate, updateAgent);

// DELETE /api/agents/:id
router.delete('/:id', authenticate, deleteAgent);

// POST /api/agents/sync
router.post('/sync', authenticate, syncAgents);

// GET /api/agents/registry-log
router.get('/registry-log', authenticate, registryLog);

// GET /api/agents/:id/registry-status
router.get('/:id/registry-status', authenticate, registryStatus);

export default router;
