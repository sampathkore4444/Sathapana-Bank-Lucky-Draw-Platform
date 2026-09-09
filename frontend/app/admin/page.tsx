'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { adminApi } from '@/lib/api';
import { formatNumber, formatCurrency, getStatusColor } from '@/lib/utils';
import { HiSparkles, HiGift, HiUserGroup, HiCurrencyDollar, HiChartBar, HiCog } from 'react-icons/hi2';

interface DashboardStats {
  overview: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalEntries: number;
    totalWinners: number;
    totalPrizeValue: number;
  };
  recentEntries: any[];
  campaignsByStatus: any[];
}

export default function AdminDashboardPage() {
  const { user, loadUser, logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await adminApi.getDashboard();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !['SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Access denied. Admin privileges required.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

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
              <span className="text-xl font-bold text-gray-900">Admin Dashboard</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin/campaigns" className="text-gray-600 hover:text-primary-600 font-medium">
                Campaigns
              </Link>
              <Link href="/admin/draws" className="text-gray-600 hover:text-primary-600 font-medium">
                Draws
              </Link>
              <Link href="/admin/winners" className="text-gray-600 hover:text-primary-600 font-medium">
                Winners
              </Link>
              <Link href="/admin/users" className="text-gray-600 hover:text-primary-600 font-medium">
                Users
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
            Welcome, {user.firstName}! 👋
          </h1>
          <p className="text-gray-600">Manage campaigns, draws, and winners</p>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <HiGift className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.overview.totalCampaigns}
                  </p>
                  <p className="text-sm text-gray-500">Total Campaigns</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                  <HiChartBar className="w-6 h-6 text-success-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatNumber(stats.overview.totalEntries)}
                  </p>
                  <p className="text-sm text-gray-500">Total Entries</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                  <HiUserGroup className="w-6 h-6 text-secondary-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.overview.totalWinners}
                  </p>
                  <p className="text-sm text-gray-500">Total Winners</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                  <HiCurrencyDollar className="w-6 h-6 text-warning-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(stats.overview.totalPrizeValue)}
                  </p>
                  <p className="text-sm text-gray-500">Total Prize Value</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/admin/campaigns/new" className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <HiGift className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create Campaign</h3>
                <p className="text-sm text-gray-500">Set up a new lucky draw</p>
              </div>
            </div>
          </Link>
          <Link href="/admin/draws" className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Execute Draw</h3>
                <p className="text-sm text-gray-500">Run the lucky draw</p>
              </div>
            </div>
          </Link>
          <Link href="/admin/winners" className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                <HiUserGroup className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Winners</h3>
                <p className="text-sm text-gray-500">Track prize fulfillment</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Entries */}
        {stats && stats.recentEntries.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Entries</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Campaign</th>
                    <th>Entries</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="font-medium">{entry.customerId}</td>
                      <td>{entry.campaignName}</td>
                      <td>{entry.entriesEarned}</td>
                      <td>{new Date(entry.entryDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
