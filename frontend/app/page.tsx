'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { campaignApi } from '@/lib/api';
import { formatDate, getCampaignTypeIcon, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { HiSparkles, HiGift, HiUserGroup, HiClock } from 'react-icons/hi2';

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  _count: {
    entries: number;
    prizes: number;
  };
}

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await campaignApi.list({ status: 'ACTIVE', limit: 10 });
      setCampaigns(response.data.data);
    } catch (error) {
      console.error('Failed to fetch campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sathapana Bank</h1>
                <p className="text-xs text-gray-500">Lucky Draw Platform</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-gray-600 hover:text-primary-600 font-medium"
                  >
                    Dashboard
                  </Link>
                  {['SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'].includes(user.role) && (
                    <Link
                      href="/admin"
                      className="text-gray-600 hover:text-primary-600 font-medium"
                    >
                      Admin
                    </Link>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">{user.firstName}</span>
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className="btn btn-primary"
                >
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Win Amazing Prizes!
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Open a Smart Savings Account or make transactions to earn entries and win
            exciting prizes like cars, motorcycles, gold, and more!
          </p>
          {!user && (
            <Link
              href="/register"
              className="btn btn-primary text-lg px-8 py-3"
            >
              Get Started
            </Link>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <HiGift className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
                <p className="text-sm text-gray-500">Active Campaigns</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                <HiUserGroup className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(campaigns.reduce((sum, c) => sum + c._count.entries, 0))}
                </p>
                <p className="text-sm text-gray-500">Total Entries</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {campaigns.reduce((sum, c) => sum + c._count.prizes, 0)}
                </p>
                <p className="text-sm text-gray-500">Prizes Available</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                <HiClock className="w-6 h-6 text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">24/7</p>
                <p className="text-sm text-gray-500">Platform Available</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campaigns */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Campaigns</h2>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="card text-center py-12">
              <HiGift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No active campaigns at the moment</p>
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
                    <span className="text-3xl">
                      {getCampaignTypeIcon(campaign.type)}
                    </span>
                    <span className={`badge ${campaign.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {campaign.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {campaign.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{formatDate(campaign.drawDate)}</span>
                    <span>{formatNumber(campaign._count.entries)} entries</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            © 2025 Sathapana Bank (Cambodia) Plc. All rights reserved.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Lucky Draw terms and conditions apply.
          </p>
        </div>
      </footer>
    </div>
  );
}
