'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { campaignApi } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiSparkles, HiCheckCircle, HiXCircle } from 'react-icons/hi2';

interface ApprovalRecord {
  id: string;
  level: number;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  approver: { id: string; firstName: string; lastName: string; role: string } | null;
}

interface ApprovalCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  submittedAt: string | null;
  createdById: string;
  creator: { id: string; firstName: string; lastName: string } | null;
  approvals: ApprovalRecord[];
}

const APPROVAL_LEVEL_LABELS: Record<number, string> = {
  1: 'Marketing Manager',
  2: 'Compliance Officer',
};

export default function AdminApprovalsPage() {
  const { user, loadUser, logout } = useAuthStore();
  const [campaigns, setCampaigns] = useState<ApprovalCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const response = await campaignApi.listForApproval({ limit: 50, status: 'PENDING_APPROVAL' });
      setCampaigns(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch approvals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (
    campaignId: string,
    level: number,
    decision: 'approve' | 'reject'
  ) => {
    const defaultComment = decision === 'approve' ? 'Approved' : 'Rejected';
    const comment = window.prompt(
      `Comment (${decision === 'approve' ? 'approving' : 'rejecting'} level ${level}):`,
      defaultComment
    );
    if (comment === null) return;

    try {
      if (decision === 'approve') {
        await campaignApi.approveApprovalLevel(campaignId, level, comment);
        toast.success(`Level ${level} approved`);
      } else {
        await campaignApi.rejectApprovalLevel(campaignId, level, comment);
        toast.success(`Level ${level} rejected`);
      }
      fetchApprovals();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update approval');
    }
  };

  if (!user || !['SUPER_ADMIN', 'MARKETING_MANAGER', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Access denied. Administrative approval role required.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Campaign Approvals</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin/campaigns" className="text-gray-600 hover:text-primary-600 font-medium">
                Campaigns
              </Link>
              <Link href="/admin/draws" className="text-gray-600 hover:text-primary-600 font-medium">
                Draws
              </Link>
              <Link href="/admin/claims" className="text-gray-600 hover:text-primary-600 font-medium">
                Claims
              </Link>
              <button onClick={logout} className="text-gray-600 hover:text-red-600 font-medium">
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Campaign Approval Workflow</h1>
          <p className="text-gray-600">
            Campaigns pending two-level approval before they can be scheduled.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card text-center py-12">
            <HiCheckCircle className="w-12 h-12 text-success-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No campaigns awaiting approval</p>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {campaign.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {campaign.type.replace('_', ' ')} • Draw: {formatDate(campaign.drawDate)} •
                      Submitted: {campaign.submittedAt ? formatDate(campaign.submittedAt) : '-'} by{' '}
                      {campaign.creator
                        ? `${campaign.creator.firstName} ${campaign.creator.lastName}`
                        : 'Unknown'}
                    </p>
                  </div>
                  <span className={`badge ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>

                <div className="space-y-3">
                  {[...campaign.approvals]
                    .sort((a, b) => a.level - b.level)
                    .map((approval) => (
                      <div
                        key={approval.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            Level {approval.level} — {APPROVAL_LEVEL_LABELS[approval.level]}
                          </p>
                          <p className="text-sm text-gray-500">
                            {approval.status === 'PENDING' && 'Awaiting decision'}
                            {approval.status === 'APPROVED' &&
                              `Approved by ${approval.approver?.firstName ?? ''} ${
                                approval.approver?.lastName ?? ''
                              }`}
                            {approval.status === 'REJECTED' &&
                              `Rejected by ${approval.approver?.firstName ?? ''} ${
                                approval.approver?.lastName ?? ''
                              }`}
                            {approval.comment ? ` — ${approval.comment}` : ''}
                          </p>
                        </div>
                        {approval.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDecision(campaign.id, approval.level, 'approve')}
                              className="btn btn-success text-sm py-1 px-3"
                            >
                              <HiCheckCircle className="w-4 h-4 inline mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecision(campaign.id, approval.level, 'reject')}
                              className="btn btn-danger text-sm py-1 px-3"
                            >
                              <HiXCircle className="w-4 h-4 inline mr-1" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className={`badge ${getStatusColor(approval.status)}`}>
                            {approval.status}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}