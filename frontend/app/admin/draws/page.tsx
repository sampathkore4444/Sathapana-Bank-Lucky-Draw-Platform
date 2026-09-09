'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { drawApi, campaignApi } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiPlay, HiCheckBadge } from 'react-icons/hi2';

interface Draw {
  id: string;
  campaignId: string;
  campaign: { id: string; name: string };
  drawDate: string;
  totalParticipants: number;
  totalEntries: number;
  isVerified: boolean;
  winners: any[];
}

export default function AdminDrawsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchDraws();
    fetchCampaigns();
  }, []);

  const fetchDraws = async () => {
    try {
      const response = await drawApi.list({ limit: 50 });
      setDraws(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch draws');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await campaignApi.list({ status: 'ACTIVE', limit: 50 });
      setCampaigns(response.data.data);
    } catch (error) {
      console.error('Failed to fetch campaigns');
    }
  };

  const handleExecuteDraw = async () => {
    if (!selectedCampaign) {
      toast.error('Please select a campaign');
      return;
    }

    if (!confirm('Are you sure you want to execute the draw? This cannot be undone.')) {
      return;
    }

    setIsExecuting(true);
    try {
      const result = await drawApi.execute({
        campaignId: selectedCampaign,
        numberOfWinners: 1,
        numberOfAlternates: 3,
      });
      
      toast.success(`Draw executed! ${result.data.data.winners.length} winner(s) selected`);
      setSelectedCampaign('');
      fetchDraws();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to execute draw');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleVerify = async (drawId: string) => {
    try {
      await drawApi.verify(drawId);
      toast.success('Draw verified successfully');
      fetchDraws();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify');
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
              <span className="text-xl font-bold text-gray-900">Draw Management</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Execute Draw Section */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Execute New Draw</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="label">Select Campaign</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="input"
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExecuteDraw}
              disabled={isExecuting || !selectedCampaign}
              className="btn btn-primary"
            >
              {isExecuting ? (
                'Executing...'
              ) : (
                <>
                  <HiPlay className="w-4 h-4 inline mr-1" />
                  Execute Draw
                </>
              )}
            </button>
          </div>
        </div>

        {/* Draws List */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Draw History</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : draws.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No draws executed yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Draw Date</th>
                    <th>Participants</th>
                    <th>Total Entries</th>
                    <th>Winners</th>
                    <th>Verified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draws.map((draw) => (
                    <tr key={draw.id}>
                      <td className="font-medium">{draw.campaign.name}</td>
                      <td>{formatDateTime(draw.drawDate)}</td>
                      <td>{formatNumber(draw.totalParticipants)}</td>
                      <td>{formatNumber(draw.totalEntries)}</td>
                      <td>{draw.winners.length}</td>
                      <td>
                        {draw.isVerified ? (
                          <span className="badge badge-success">Verified</span>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/admin/draws/${draw.id}`}
                          className="text-primary-600 hover:underline text-sm"
                        >
                          View Details
                        </Link>
                        {!draw.isVerified && (
                          <button
                            onClick={() => handleVerify(draw.id)}
                            className="ml-2 text-success-600 hover:underline text-sm"
                          >
                            <HiCheckBadge className="w-4 h-4 inline" /> Verify
                          </button>
                        )}
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
