'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { winnerApi } from '@/lib/api';
import { formatDateTime, formatCurrency, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiCheck, HiXMark, HiPhone, HiEnvelope } from 'react-icons/hi2';

interface Winner {
  id: string;
  customerId: string;
  rank: number;
  entriesAtDraw: number;
  status: string;
  createdAt: string;
  prize: {
    name: string;
    category: string;
    estimatedValue: number;
  };
  drawResult: {
    drawDate: string;
    campaign: { id: string; name: string };
  };
}

export default function AdminWinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchWinners();
  }, [filterStatus]);

  const fetchWinners = async () => {
    try {
      const params: any = { limit: 50 };
      if (filterStatus) params.status = filterStatus;
      
      const response = await winnerApi.list(params);
      setWinners(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch winners');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (winnerId: string, status: string) => {
    try {
      await winnerApi.updateStatus(winnerId, { status });
      toast.success(`Winner status updated to ${status}`);
      fetchWinners();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const handlePromoteAlternate = async (winnerId: string) => {
    try {
      await winnerApi.promoteAlternate(winnerId);
      toast.success('Alternate promoted to winner');
      fetchWinners();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to promote');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Winner Management</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <label className="label mb-0">Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Status</option>
              <option value="SELECTED">Selected</option>
              <option value="VERIFIED">Verified</option>
              <option value="CONTACTED">Contacted</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="DECLINED">Declined</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>
        </div>

        {/* Winners List */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Winners</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : winners.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No winners found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Prize</th>
                    <th>Value</th>
                    <th>Campaign</th>
                    <th>Draw Date</th>
                    <th>Entries</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map((winner) => (
                    <tr key={winner.id}>
                      <td>
                        <div>
                          <p className="font-medium">{winner.customerId}</p>
                          <p className="text-xs text-gray-500">Rank #{winner.rank}</p>
                        </div>
                      </td>
                      <td>{winner.prize.name}</td>
                      <td>{formatCurrency(winner.prize.estimatedValue)}</td>
                      <td>{winner.drawResult.campaign.name}</td>
                      <td>{formatDateTime(winner.drawResult.drawDate)}</td>
                      <td>{winner.entriesAtDraw}</td>
                      <td>
                        <span className={`badge ${getStatusColor(winner.status)}`}>
                          {winner.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {winner.status === 'SELECTED' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(winner.id, 'VERIFIED')}
                                className="btn btn-success text-xs py-1 px-2"
                                title="Verify"
                              >
                                <HiCheck className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(winner.id, 'DECLINED')}
                                className="btn btn-danger text-xs py-1 px-2"
                                title="Decline"
                              >
                                <HiXMark className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {winner.status === 'VERIFIED' && (
                            <button
                              onClick={() => handleUpdateStatus(winner.id, 'CONTACTED')}
                              className="btn btn-primary text-xs py-1 px-2"
                              title="Mark as Contacted"
                            >
                              <HiPhone className="w-3 h-3" />
                            </button>
                          )}
                          {winner.status === 'CONTACTED' && (
                            <button
                              onClick={() => handleUpdateStatus(winner.id, 'ACCEPTED')}
                              className="btn btn-success text-xs py-1 px-2"
                              title="Mark as Accepted"
                            >
                              <HiCheck className="w-3 h-3" />
                            </button>
                          )}
                          {winner.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleUpdateStatus(winner.id, 'FULFILLED')}
                              className="btn btn-success text-xs py-1 px-2"
                              title="Mark as Fulfilled"
                            >
                              <HiCheck className="w-3 h-3" /> Done
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
