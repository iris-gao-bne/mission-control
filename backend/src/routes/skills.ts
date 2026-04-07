import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { ROLES } from '../types/role'
import { createSkillSchema } from '../types/crew'
import { listSkills, createSkill, deleteSkill, SkillError } from '../services/skills.service'

export const skillsRouter = Router()

skillsRouter.use(authenticate)

function handleError(res: Response, err: unknown) {
  if (err instanceof SkillError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}

// GET /api/skills
skillsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await listSkills(req.user!.orgId))
  } catch (err) {
    handleError(res, err)
  }
})

// POST /api/skills — Director only
skillsRouter.post(
  '/',
  requireRole(ROLES.DIRECTOR),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createSkillSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors })
      return
    }
    try {
      res.status(201).json(await createSkill(parsed.data, req.user!.orgId))
    } catch (err) {
      handleError(res, err)
    }
  }
)

// DELETE /api/skills/:id — Director only
skillsRouter.delete(
  '/:id',
  requireRole(ROLES.DIRECTOR),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteSkill(req.params.id, req.user!.orgId)
      res.status(204).send()
    } catch (err) {
      handleError(res, err)
    }
  }
)
