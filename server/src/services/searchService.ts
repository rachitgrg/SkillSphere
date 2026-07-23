import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import User from '../models/User';
import { SearchFilters, PaginationOptions } from '../types';
import { buildPaginationResponse } from '../utils/helpers';

class SearchService {
  async searchGigs(
    filters: SearchFilters,
    pagination: PaginationOptions
  ) {
    const query: Record<string, unknown> = {
      status: filters.status || 'open',
      visibility: 'public',
    };

    // Text search
    if (filters.query) {
      query.$text = { $search: filters.query };
    }

    // Category filter
    if (filters.category) {
      query.category = filters.category;
    }

    // Skills filter
    if (filters.skills && filters.skills.length > 0) {
      query.skills = { $in: filters.skills };
    }

    // Budget range
    if (filters.budgetMin || filters.budgetMax) {
      if (filters.budgetMin) {
        query.budgetMax = { $gte: filters.budgetMin };
      }
      if (filters.budgetMax) {
        query.budgetMin = { $lte: filters.budgetMax };
      }
    }

    // Experience level
    if (filters.experienceLevel) {
      query.experienceLevel = filters.experienceLevel;
    }

    // Location type
    if (filters.locationType) {
      query.locationType = filters.locationType;
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [gigs, total] = await Promise.all([
      Gig.find(query)
        .populate('client', 'firstName lastName avatar')
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean(),
      Gig.countDocuments(query),
    ]);

    return {
      gigs,
      pagination: buildPaginationResponse(total, pagination.page, pagination.limit),
    };
  }

  async searchFreelancers(
    filters: SearchFilters,
    pagination: PaginationOptions
  ) {
    const query: Record<string, unknown> = {};

    // Skills filter
    if (filters.skills && filters.skills.length > 0) {
      query['skills.name'] = {
        $in: filters.skills.map((s) => new RegExp(s, 'i')),
      };
    }

    // Budget/hourly rate range
    if (filters.budgetMin) {
      query.hourlyRate = { ...(query.hourlyRate as object || {}), $gte: filters.budgetMin };
    }
    if (filters.budgetMax) {
      query.hourlyRate = { ...(query.hourlyRate as object || {}), $lte: filters.budgetMax };
    }

    const skip = (pagination.page - 1) * pagination.limit;

    // Build sort
    let sort: Record<string, 1 | -1> = { averageRating: -1 };
    if (filters.sortBy === 'rate') {
      sort = { hourlyRate: filters.sortOrder === 'asc' ? 1 : -1 };
    } else if (filters.sortBy === 'rating') {
      sort = { averageRating: -1 };
    } else if (filters.sortBy === 'completedGigs') {
      sort = { completedGigs: -1 };
    }

    const [profiles, total] = await Promise.all([
      FreelancerProfile.find(query)
        .populate('user', 'firstName lastName avatar email isActive')
        .sort(sort)
        .skip(skip)
        .limit(pagination.limit)
        .lean(),
      FreelancerProfile.countDocuments(query),
    ]);

    // Filter out inactive/banned users
    const activeProfiles = profiles.filter(
      (p: any) => p.user && p.user.isActive
    );

    return {
      freelancers: activeProfiles,
      pagination: buildPaginationResponse(total, pagination.page, pagination.limit),
    };
  }

  async searchUsers(
    queryStr: string,
    pagination: PaginationOptions
  ) {
    const query: Record<string, unknown> = {
      isActive: true,
      isBanned: false,
    };

    if (queryStr) {
      query.$or = [
        { firstName: new RegExp(queryStr, 'i') },
        { lastName: new RegExp(queryStr, 'i') },
        { email: new RegExp(queryStr, 'i') },
      ];
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email avatar role createdAt')
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      users,
      pagination: buildPaginationResponse(total, pagination.page, pagination.limit),
    };
  }

  async getGigSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const gigs = await Gig.find({
      title: new RegExp(query, 'i'),
      status: 'open',
    })
      .select('title')
      .limit(10)
      .lean();

    return gigs.map((g) => g.title);
  }

  async getPopularSkills(limit: number = 20): Promise<{ skill: string; count: number }[]> {
    const result = await Gig.aggregate([
      { $match: { status: 'open' } },
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return result.map((r: { _id: string; count: number }) => ({
      skill: r._id,
      count: r.count,
    }));
  }

  async getPopularCategories(
    limit: number = 20
  ): Promise<{ category: string; count: number }[]> {
    const result = await Gig.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return result.map((r: { _id: string; count: number }) => ({
      category: r._id,
      count: r.count,
    }));
  }
}

export default new SearchService();
