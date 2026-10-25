import { Router } from 'express';
import { searchGigs, searchFreelancers, getTrendingSkills, getSuggestions, getCategories } from '../controllers/searchController';

const router = Router();

// All search endpoints are public.
router.get('/gigs', searchGigs);
router.get('/freelancers', searchFreelancers);
router.get('/trending-skills', getTrendingSkills);
router.get('/suggestions', getSuggestions);
router.get('/categories', getCategories);

export default router;
