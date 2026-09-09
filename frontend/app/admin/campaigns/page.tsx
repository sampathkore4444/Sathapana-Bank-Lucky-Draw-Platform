'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { campaignApi } from '@/lib/api';
import { formatDate, getStatusColor, getCampaignTypeIcon, formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiPlus, HiPlay, HiPause, HiStop } from 'react-icons/hi2';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  _count: { entries: number; prizes: number };
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await campaignApi.list({ limit: 50 });
      setCampaigns(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await campaignApi.activate(id);
      toast.success('Campaign activated');
      fetchCampaigns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await campaignApi.pause(id);
      toast.success('Campaign paused');
      fetchCampaigns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to pause');
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Are you sure you want to close this campaign?')) return;
    
    try {
      await campaignApi.close(id);
      toast.success('Campaign closed');
      fetchCampaigns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to close');
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
              <span className="text-xl font-bold text-gray-900">Campaign Management</span>
            </Link>
            <Link href="/admin/campaigns/new" className="btn btn-primary">
              <HiPlus className="w-4 h-4 inline mr-1" />
              New Campaign
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Campaigns</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No campaigns found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Entries</th>
                    <th>Draw Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </td>
                      <td>
                        <span className="text-lg mr-2">{getCampaignTypeIcon(campaign.type)}</span>
                        {campaign.type.replace('_', ' ')}
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td>{formatNumber(campaign._count.entries)}</td>
                      <td>{formatDate(campaign.drawDate)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {campaign.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleActivate(campaign.id)}
                              className="btn btn-success text-sm py-1 px-2"
                              title="Activate"
                            >
                              <HiPlay className="w-4 h-4" />
                            </button>
                          )}
                          {campaign.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handlePause(campaign.id)}
                                className="btn btn-warning text-sm py-1 px-2"
                                title="Pause"
                              >
                                <HiPause className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleClose(campaign.id)}
                                className="btn btn-danger text-sm py-1 px-2"
                                title="Close"
                              >
                                <HiStop className="w-4 h-4" />
                              </button>
                            </>
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
