'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { campaignApi, entryApi } from '@/lib/api';
import { formatDate, formatNumber, getCampaignTypeIcon, getStatusColor } from '@/lib/utils';
import { HiSparkles, HiGift, HiClock, HiArrowRight } from 'react-icons/hi2';

interface CampaignSummary {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  totalEntries: number;
  lastEntryDate: string;
  totalParticipants: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loadUser, logout } = useAuthStore();
  const [summary, setSummary] = useState<CampaignSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user]);

  const fetchSummary = async () => {
    try {
      const response = await entryApi.getCustomerSummary(user!.id);
      setSummary(response.data.data.campaigns);
    } catch (error) {
      console.error('Failed to fetch summary');
    } finally {
      setIsLoading(false);
    }
  };

  const totalEntries = summary.reduce((sum, s) => sum + s.totalEntries, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Sathapana Lucky Draw</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/campaigns" className="text-gray-600 hover:text-primary-600 font-medium">
                Campaigns
              </Link>
              <button onClick={logout} className="text-gray-600 hover:text-red-600 font-medium">
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-600">Track your entries and see your progress</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <HiGift className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(totalEntries)}</p>
                <p className="text-sm text-gray-500">Total Entries</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{summary.length}</p>
                <p className="text-sm text-gray-500">Active Campaigns</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                <HiClock className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.filter((s) => s.campaignStatus === 'ACTIVE').length}
                </p>
                <p className="text-sm text-gray-500">Running Campaigns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Progress */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Campaign Progress</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : summary.length === 0 ? (
            <div className="text-center py-8">
              <HiGift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">You haven't joined any campaigns yet</p>
              <Link href="/campaigns" className="btn btn-primary">
                Browse Campaigns
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {summary.map((item) => (
                <Link
                  key={item.campaignId}
                  href={`/campaigns/${item.campaignId}`}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-2xl">
                    🎰
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.campaignName}</h3>
                    <p className="text-sm text-gray-500">
                      {item.totalEntries} entries • {item.totalParticipants} participants
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${getStatusColor(item.campaignStatus)}`}>
                      {item.campaignStatus}
                    </span>
                  </div>
                  <HiArrowRight className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Open Account</h3>
              <p className="text-sm text-gray-600">
                Open a Smart Savings Account or make transactions
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Earn Entries</h3>
              <p className="text-sm text-gray-600">
                Each qualifying action earns you entries into the draw
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Win Prizes</h3>
              <p className="text-sm text-gray-600">
                More entries means higher chances to win amazing prizes!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
