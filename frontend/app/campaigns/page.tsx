'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { campaignApi } from '@/lib/api';
import { formatDate, getCampaignTypeIcon, formatNumber, getStatusColor } from '@/lib/utils';
import { HiSparkles } from 'react-icons/hi2';

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  _count: { entries: number; prizes: number };
}

export default function CampaignsPage() {
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
      console.error('Failed to fetch campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">All Campaigns</span>
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-primary-600 font-medium">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No campaigns available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="card hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{getCampaignTypeIcon(campaign.type)}</span>
                  <span className={`badge ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{campaign.name}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{campaign.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{formatDate(campaign.drawDate)}</span>
                  <span>{formatNumber(campaign._count.entries)} entries</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
