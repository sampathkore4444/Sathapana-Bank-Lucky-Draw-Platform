'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { claimApi } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiSparkles, HiCheckCircle, HiXCircle, HiGift } from 'react-icons/hi2';

interface ClaimRecord {
  id: string;
  status: string;
  claimedAt: string;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  winner: {
    customerId: string;
    status: string;
    rank: number;
    prize: { name: string; category: string };
    drawResult: { campaign: { id: string; name: string } };
  };
  documents: Array<{ id: string; type: string; status: string }>;
}

const CLAIM_STATUS_FILTERS = ['', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FULFILLED'];

export default function AdminClaimsPage() {
  const { user, loadUser, logout } = useAuthStore();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [filter]);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const response = await claimApi.list({
        limit: 50,
        ...(filter ? { status: filter } : {}),
      });
      setClaims(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch claims');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const confirmed =
      status === 'APPROVED'
        ? true
        : window.confirm('Reject this claim? The winner will not receive the prize.');
    if (!confirmed) return;

    try {
      await claimApi.review(id, { status });
      toast.success(`Claim ${status.toLowerCase()}`);
      fetchClaims();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to review claim');
    }
  };

  const handleFulfill = async (id: string) => {
    if (!window.confirm('Mark this claim as fulfilled? This confirms prize delivery.')) return;
    try {
      await claimApi.fulfill(id);
      toast.success('Claim fulfilled');
      fetchClaims();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fulfill claim');
    }
  };

  if (!user || !['SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Access denied. Claims role required.</p>
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
              <span className="text-xl font-bold text-gray-900">Prize Claims</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin/campaigns" className="text-gray-600 hover:text-primary-600 font-medium">
                Campaigns
              </Link>
              <Link href="/admin/approvals" className="text-gray-600 hover:text-primary-600 font-medium">
                Approvals
              </Link>
              <button onClick={logout} className="text-gray-600 hover:text-red-600 font-medium">
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Winner Claims</h1>
            <p className="text-gray-600">Review documents and manage prize fulfillment</p>
          </div>
          <div className="flex items-center gap-2">
            {CLAIM_STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`btn text-sm py-1 px-3 ${filter === s ? 'btn-primary' : ''}`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="card text-center py-12">
            <HiGift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No claims found for this filter</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-2xl">
                      🏆
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {claim.winner?.prize?.name ?? 'Prize'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {claim.winner?.drawResult?.campaign?.name ?? 'Campaign'} • Customer{' '}
                        {claim.winner?.customerId ?? '-'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Claimed: {formatDate(claim.claimedAt)} • Documents:{' '}
                        {claim.documents?.length ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getStatusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                    {claim.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handleReview(claim.id, 'APPROVED')}
                        className="btn btn-success text-sm py-1 px-2"
                        title="Approve claim"
                      >
                        <HiCheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {claim.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handleReview(claim.id, 'REJECTED')}
                        className="btn btn-danger text-sm py-1 px-2"
                        title="Reject claim"
                      >
                        <HiXCircle className="w-4 h-4" />
                      </button>
                    )}
                    {claim.status === 'APPROVED' && (
                      <button
                        onClick={() => handleFulfill(claim.id)}
                        className="btn btn-primary text-sm py-1 px-2"
                        title="Mark fulfilled"
                      >
                        Fulfill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}