import prisma from '../config/database';
import { CampaignType } from '@prisma/client';
import { AppError } from '../utils/appError';
import { CampaignQuery } from '../types';
import { messageQueue } from './messageQueue';

interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  startDate: string;
  endDate: string;
  drawDate: string;
  eligibilityCriteria?: any;
  entryRules?: any[];
  drawSettings?: any;
  termsAndConditions?: string;
  notificationSettings?: any;
}

interface UpdateCampaignInput {
  name?: string;
  description?: string;
  type?: CampaignType;
  startDate?: string;
  endDate?: string;
  drawDate?: string;
  eligibilityCriteria?: any;
  entryRules?: any[];
  drawSettings?: any;
  termsAndConditions?: string;
  notificationSettings?: any;
}

// Approval levels expected for the multi-level workflow.
// Level 1 = Marketing Manager, Level 2 = Compliance Officer (Super Admin may perform any level).
const APPROVAL_LEVEL_ROLES: Record<number, string[]> = {
  1: ['MARKETING_MANAGER', 'SUPER_ADMIN'],
  2: ['COMPLIANCE_OFFICER', 'SUPER_ADMIN'],
};

export class CampaignService {
  async list(query: CampaignQuery) {
    const { page = 1, limit = 10, status, type } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { entries: true, prizes: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { data: campaigns, total, page, limit };
  }

  async getById(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        _count: { select: { entries: true, drawResults: true } },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    return campaign;
  }

  async create(data: CreateCampaignInput, userId: string) {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        drawDate: new Date(data.drawDate),
        eligibilityCriteria: data.eligibilityCriteria || {},
        entryRules: data.entryRules || [],
        drawSettings: data.drawSettings || {},
        termsAndConditions: data.termsAndConditions,
        notificationSettings: data.notificationSettings || {},
        createdBy: userId,
      },
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'CREATED',
        performedBy: userId,
        details: { campaignName: data.name },
      },
    });

    return campaign;
  }

  /**
   * Duplicate an existing campaign (including its prizes) as a new DRAFT.
   */
  async duplicate(id: string, userId: string) {
    const source = await prisma.campaign.findUnique({
      where: { id },
      include: { prizes: true },
    });

    if (!source) {
      throw new AppError('Campaign not found', 404);
    }

    const durationMs = source.endDate.getTime() - source.startDate.getTime();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationMs);
    // New draw date shifted to the end of the new window (or +30 days for the draw window)
    const drawDate = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const name = `${source.name} (Copy)`;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description: source.description,
        type: source.type,
        status: 'DRAFT',
        startDate,
        endDate,
        drawDate,
        eligibilityCriteria: source.eligibilityCriteria || {},
        entryRules: source.entryRules || [],
        drawSettings: source.drawSettings || {},
        termsAndConditions: source.termsAndConditions,
        notificationSettings: source.notificationSettings || {},
        metadata: source.metadata || {},
        sourceCampaignId: source.id,
        createdBy: userId,
      },
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    });

    // Duplicate prizes
    if (source.prizes.length > 0) {
      await prisma.prize.createMany({
        data: source.prizes.map((prize) => ({
          campaignId: campaign.id,
          rank: prize.rank,
          name: prize.name,
          category: prize.category,
          description: prize.description,
          quantity: prize.quantity,
          estimatedValue: prize.estimatedValue,
          currency: prize.currency,
          vendorName: prize.vendorName,
          vendorContact: (prize.vendorContact as any) ?? undefined,
          fulfillmentInstructions: prize.fulfillmentInstructions,
          alternativesOffered: prize.alternativesOffered || [],
          termsAndConditions: prize.termsAndConditions,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'DUPLICATED',
        performedBy: userId,
        details: { sourceCampaignId: source.id, campaignName: name },
      },
    });

    return campaign;
  }

  /**
   * Submit a draft campaign for the multi-level approval workflow.
   */
  async submitForApproval(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'DRAFT' && campaign.status !== 'PENDING_APPROVAL') {
      throw new AppError('Only draft campaigns can be submitted for approval', 400);
    }

    const hasPrizes = await prisma.prize.count({ where: { campaignId: id } });
    if (hasPrizes === 0) {
      throw new AppError('Campaign must have at least one prize before submission', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        submittedBy: userId,
        submittedAt: new Date(),
        updatedBy: userId,
      },
    });

    // Ensure approval records exist for both levels (idempotent)
    for (const level of [1, 2]) {
      await prisma.campaignApproval.upsert({
        where: { campaignId_level: { campaignId: id, level } },
        update: { status: 'PENDING', approverId: null, comment: null, decidedAt: null },
        create: { campaignId: id, level, status: 'PENDING' },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'SUBMITTED_FOR_APPROVAL',
        performedBy: userId,
        details: { previousStatus: campaign.status },
      },
    });

    return updated;
  }

  /**
   * Approve a campaign at a given approval level.
   */
  async approveCampaign(id: string, level: number, userId: string, role: string, comment?: string) {
    const allowedRoles = APPROVAL_LEVEL_ROLES[level];
    if (!allowedRoles) {
      throw new AppError('Invalid approval level', 400);
    }
    if (!allowedRoles.includes(role)) {
      throw new AppError('Your role cannot approve this level', 403);
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { approvals: true },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'PENDING_APPROVAL') {
      throw new AppError('Campaign is not awaiting approval', 400);
    }

    const approval = campaign.approvals.find((a) => a.level === level);
    if (!approval) {
      throw new AppError('Campaign was not submitted for approval', 400);
    }

    // Levels must be approved in order
    const lowerLevelsApproved = campaign.approvals
      .filter((a) => a.level < level)
      .every((a) => a.status === 'APPROVED');

    if (!lowerLevelsApproved) {
      throw new AppError('Previous approval levels must be approved first', 400);
    }

    if (approval.status === 'APPROVED') {
      throw new AppError('This level has already been approved', 400);
    }

    await prisma.campaignApproval.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', approverId: userId, comment, decidedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'APPROVAL_LEVEL_APPROVED',
        performedBy: userId,
        details: { level, comment },
      },
    });

    // When all levels approved, move the campaign to SCHEDULED
    const allApproved = [...campaign.approvals.filter((a) => a.id !== approval.id), {
      status: 'APPROVED' as const,
    }].every((a) => a.status === 'APPROVED');

    if (allApproved) {
      const approved = await prisma.campaign.update({
        where: { id },
        data: {
          status: 'SCHEDULED',
          approvedBy: userId,
          approvedAt: new Date(),
          updatedBy: userId,
        },
      });
      return approved;
    }

    return campaign;
  }

  /**
   * Reject a campaign at a given approval level.
   */
  async rejectCampaign(id: string, level: number, userId: string, role: string, comment?: string) {
    const allowedRoles = APPROVAL_LEVEL_ROLES[level];
    if (!allowedRoles) {
      throw new AppError('Invalid approval level', 400);
    }
    if (!allowedRoles.includes(role)) {
      throw new AppError('Your role cannot reject this level', 403);
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { approvals: true },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'PENDING_APPROVAL') {
      throw new AppError('Campaign is not awaiting approval', 400);
    }

    const approval = campaign.approvals.find((a) => a.level === level);
    if (!approval) {
      throw new AppError('Campaign was not submitted for approval', 400);
    }

    await prisma.campaignApproval.update({
      where: { id: approval.id },
      data: { status: 'REJECTED', approverId: userId, comment, decidedAt: new Date() },
    });

    const rejected = await prisma.campaign.update({
      where: { id },
      data: { status: 'DRAFT', updatedBy: userId },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'APPROVAL_LEVEL_REJECTED',
        performedBy: userId,
        details: { level, comment },
      },
    });

    return rejected;
  }

  async update(id: string, data: UpdateCampaignInput, userId: string) {
    const existing = await prisma.campaign.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      throw new AppError('Cannot update campaign in current status', 400);
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        drawDate: data.drawDate ? new Date(data.drawDate) : undefined,
        updatedBy: userId,
      },
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    });

    return campaign;
  }

  async delete(id: string) {
    const existing = await prisma.campaign.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Campaign not found', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError('Can only delete draft campaigns', 400);
    }

    await prisma.campaign.delete({ where: { id } });
  }

  async activate(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { approvals: true },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED', 'PENDING_APPROVAL'].includes(campaign.status)) {
      throw new AppError('Cannot activate campaign in current status', 400);
    }

    // Enforce the multi-level approval workflow if the campaign uses it
    const approvals = campaign.approvals ?? [];
    if (approvals.length > 0) {
      const hasPending = approvals.some((a) => a.status !== 'APPROVED');
      if (hasPending) {
        throw new AppError('Campaign must be fully approved before activation', 400);
      }
      const rejected = approvals.some((a) => a.status === 'REJECTED');
      if (rejected) {
        throw new AppError('Campaign was rejected during approval and cannot be activated', 400);
      }
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'ACTIVATED',
        performedBy: userId,
        details: { previousStatus: campaign.status },
      },
    });

    // Queue draw reminders for existing participants (best-effort, must not fail the activation)
    try {
      const participants = await prisma.customerEntry.groupBy({
        by: ['customerId'],
        where: { campaignId: id },
        _sum: { entriesEarned: true },
      });

      for (const participant of participants) {
        await messageQueue.publish('notifications', 'DRAW_REMINDER', {
          customerId: participant.customerId,
          campaignId: id,
          campaignName: campaign.name,
          drawDate: campaign.drawDate.toISOString(),
          totalEntries: participant._sum.entriesEarned || 0,
        });
      }
    } catch (error) {
      console.error('Failed to queue draw reminders:', error);
    }

    return updated;
  }

  async pause(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new AppError('Can only pause active campaigns', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'SCHEDULED', updatedBy: userId },
    });

    return updated;
  }

  async close(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'CLOSED', updatedBy: userId },
    });

    return updated;
  }

  async getStats(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { entries: true, prizes: true, drawResults: true } },
        entries: {
          select: { entriesEarned: true, verified: true, entryType: true, customerId: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const totalEntries = campaign.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
    const uniqueParticipants = new Set(campaign.entries.map((e) => e.customerId)).size;
    const verifiedEntries = campaign.entries.filter((e) => e.verified).length;

    const entryTypeBreakdown = campaign.entries.reduce((acc, e) => {
      acc[e.entryType] = (acc[e.entryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      totalEntries,
      uniqueParticipants,
      verifiedEntries,
      unverifiedEntries: campaign.entries.length - verifiedEntries,
      totalPrizes: campaign._count.prizes,
      totalDraws: campaign._count.drawResults,
      entryTypeBreakdown,
    };
  }

  /**
   * List campaigns awaiting (or that went through) approval, with their approval records.
   */
  async listForApproval(query: CampaignQuery) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.approvals = { some: {} };
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          approvals: {
            include: { approver: { select: { id: true, firstName: true, lastName: true, role: true } } },
          },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { data: campaigns, total, page, limit };
  }
}

export const campaignService = new CampaignService();
