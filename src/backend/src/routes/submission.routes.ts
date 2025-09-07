/**
 * Submission management routes
 */

import { Router } from 'express';
import { SubmissionController } from '../controllers/submission.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validate, submissionSchemas, validatePcrForm } from '../middleware/validation.middleware';

export function createSubmissionRoutes(submissionController: SubmissionController): Router {
  const router = Router();

  // All submission routes require authentication
  router.use(requireAuth);

  /**
   * @route POST /api/submissions
   * @desc Create new submission
   * @access Private
   */
  router.post(
    '/',
    validate(submissionSchemas.create),
    validatePcrForm,
    submissionController.createSubmission
  );

  /**
   * @route GET /api/submissions
   * @desc Get user's submissions
   * @access Private
   */
  router.get(
    '/',
    validate(submissionSchemas.list),
    submissionController.getUserSubmissions
  );

  /**
   * @route GET /api/submissions/all
   * @desc Get all submissions (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/all',
    requireAdmin,
    validate(submissionSchemas.list),
    submissionController.getAllSubmissions
  );

  /**
   * @route GET /api/submissions/stats
   * @desc Get submission statistics (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/stats',
    requireAdmin,
    submissionController.getSubmissionStats
  );

  /**
   * @route GET /api/submissions/summary
   * @desc Get submission summary
   * @access Private
   */
  router.get(
    '/summary',
    submissionController.getSubmissionSummary
  );

  /**
   * @route GET /api/submissions/export
   * @desc Export submissions as CSV (admin only)
   * @access Private (Admin)
   */
  router.get(
    '/export',
    requireAdmin,
    submissionController.exportSubmissions
  );

  /**
   * @route GET /api/submissions/:id
   * @desc Get specific submission
   * @access Private (Owner or Admin)
   */
  router.get(
    '/:id',
    validate(submissionSchemas.get),
    submissionController.getSubmission
  );

  /**
   * @route DELETE /api/submissions/:id
   * @desc Delete submission (admin or owner within time limit)
   * @access Private
   */
  router.delete(
    '/:id',
    validate(submissionSchemas.get),
    submissionController.deleteSubmission
  );

  return router;
}