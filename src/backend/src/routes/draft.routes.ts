/**
 * Draft management routes
 */

import { Router } from 'express';
import { DraftController } from '../controllers/draft.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validate, draftSchemas, validatePcrForm } from '../middleware/validation.middleware';

export function createDraftRoutes(draftController: DraftController): Router {
  const router = Router();

  // All draft routes require authentication
  router.use(requireAuth);

  /**
   * @route POST /api/drafts
   * @desc Save new draft
   * @access Private
   */
  router.post(
    '/',
    validate(draftSchemas.save),
    validatePcrForm,
    draftController.saveDraft
  );

  /**
   * @route GET /api/drafts
   * @desc Get user's drafts
   * @access Private
   */
  router.get(
    '/',
    validate(draftSchemas.list),
    draftController.getUserDrafts
  );

  /**
   * @route GET /api/drafts/all
   * @desc Get all drafts (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/all',
    requireAdmin,
    validate(draftSchemas.list),
    draftController.getAllDrafts
  );

  /**
   * @route GET /api/drafts/stats
   * @desc Get draft statistics (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/stats',
    requireAdmin,
    draftController.getDraftStats
  );

  /**
   * @route POST /api/drafts/cleanup
   * @desc Clean up expired drafts (admin only)
   * @access Private (Admin)
   */
  router.post(
    '/cleanup',
    requireAdmin,
    draftController.cleanupExpiredDrafts
  );

  /**
   * @route GET /api/drafts/:id
   * @desc Get specific draft
   * @access Private (Owner only)
   */
  router.get(
    '/:id',
    validate(draftSchemas.get),
    draftController.getDraft
  );

  /**
   * @route PUT /api/drafts/:id
   * @desc Update existing draft
   * @access Private (Owner only)
   */
  router.put(
    '/:id',
    validate(draftSchemas.update),
    validatePcrForm,
    draftController.saveDraft
  );

  /**
   * @route DELETE /api/drafts/:id
   * @desc Delete draft
   * @access Private (Owner only)
   */
  router.delete(
    '/:id',
    validate(draftSchemas.delete),
    draftController.deleteDraft
  );

  /**
   * @route DELETE /api/drafts/:id/force
   * @desc Force delete draft (admin only)
   * @access Private (Admin)
   */
  router.delete(
    '/:id/force',
    requireAdmin,
    validate(draftSchemas.delete),
    draftController.forceDeleteDraft
  );

  return router;
}