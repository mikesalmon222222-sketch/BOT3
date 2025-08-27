import React, { useEffect, useState } from 'react';
import { bidsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import TopBar from '../components/TopBar';
import BidTable from '../components/BidTable';
import './HuntingData.css';

const HuntingData = () => {
  const { state, actions, handleAsync } = useApp();
  const [bids, setBids] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    portal: 'SEPTA'
  });
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);

  useEffect(() => {
    loadBids(1);
  }, []);

  const loadBids = async (page = 1, newFilters = filters) => {
    try {
      await handleAsync(async () => {
        const params = {
          page,
          limit: 10,
          ...newFilters
        };

        // Remove empty filters
        Object.keys(params).forEach(key => {
          if (!params[key]) delete params[key];
        });

        const response = await bidsAPI.getBids(params);
        const { bids: fetchedBids, pagination: paginationData } = response.data.data;
        
        setBids(fetchedBids);
        setPagination(paginationData);
        actions.setBids(fetchedBids, paginationData);
      }, 'Failed to load bids');
    } catch (error) {
      // Error handled by handleAsync
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadBids(1, filters);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      dateFrom: '',
      dateTo: '',
      portal: 'SEPTA'
    };
    setFilters(resetFilters);
    loadBids(1, resetFilters);
  };

  const handlePageChange = (newPage) => {
    loadBids(newPage, filters);
  };

  const handleManualFetch = async () => {
    setFetching(true);
    setFetchResult(null);

    try {
      await handleAsync(async () => {
        const response = await bidsAPI.fetchSeptaBids();
        setFetchResult(response.data.data);
        actions.setLastFetchTime(new Date().toISOString());
        
        // Reload bids after fetch
        setTimeout(() => {
          loadBids(pagination.currentPage, filters);
        }, 1000);
      }, 'Failed to fetch SEPTA bids');
    } catch (error) {
      setFetchResult({ inserted: 0, updated: 0, skipped: 0, error: error.message });
    } finally {
      setFetching(false);
    }
  };

  const formatFilterDate = (dateString) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
  };

  const setDateFilter = (daysAgo, label) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const filterDate = date.toISOString().split('T')[0];
    
    const newFilters = {
      ...filters,
      dateFrom: filterDate,
      dateTo: ''
    };
    setFilters(newFilters);
    loadBids(1, newFilters);
  };

  return (
    <div className="hunting-data">
      <TopBar 
        title="Hunting Data" 
        subtitle={`Browse and manage SEPTA bid listings (${pagination.totalItems} total)`}
      />
      
      <div className="hunting-data-content">
        {/* Controls Section */}
        <div className="controls-section">
          <div className="fetch-controls">
            <button
              onClick={handleManualFetch}
              disabled={fetching}
              className="fetch-btn"
            >
              {fetching ? '🔄 Fetching...' : '🔄 Fetch Now'}
            </button>
            
            {fetchResult && (
              <div className={`fetch-result ${fetchResult.error ? 'error' : 'success'}`}>
                {fetchResult.error ? (
                  <span>❌ Error: {fetchResult.error}</span>
                ) : (
                  <span>
                    ✅ Fetched: {fetchResult.inserted} new, {fetchResult.updated} updated, {fetchResult.skipped} skipped
                  </span>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleFilterSubmit} className="filters-form">
            <div className="filter-group">
              <label htmlFor="dateFrom">From Date:</label>
              <input
                type="date"
                id="dateFrom"
                name="dateFrom"
                value={formatFilterDate(filters.dateFrom)}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="dateTo">To Date:</label>
              <input
                type="date"
                id="dateTo"
                name="dateTo"
                value={formatFilterDate(filters.dateTo)}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-actions">
              <button type="submit" className="filter-btn filter-btn-primary">
                Apply Filters
              </button>
              <button 
                type="button" 
                onClick={handleResetFilters}
                className="filter-btn filter-btn-secondary"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="quick-filters">
            <span className="quick-filters-label">Quick filters:</span>
            <button 
              onClick={() => setDateFilter(0, 'Today')}
              className="quick-filter-btn"
            >
              Today
            </button>
            <button 
              onClick={() => setDateFilter(7, 'Last 7 days')}
              className="quick-filter-btn"
            >
              Last 7 days
            </button>
            <button 
              onClick={() => setDateFilter(30, 'Last 30 days')}
              className="quick-filter-btn"
            >
              Last 30 days
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div className="table-section">
          <BidTable
            bids={bids}
            pagination={pagination}
            onBidsUpdate={() => loadBids(pagination.currentPage, filters)}
          />
        </div>

        {/* Summary Section */}
        {bids.length > 0 && (
          <div className="summary-section">
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="summary-label">Showing:</span>
                <span className="summary-value">
                  {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - {' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {' '}
                  {pagination.totalItems} bids
                </span>
              </div>
              
              <div className="summary-stat">
                <span className="summary-label">Active bids:</span>
                <span className="summary-value">
                  {bids.filter(bid => !bid.dueDate || new Date(bid.dueDate) > new Date()).length}
                </span>
              </div>
              
              <div className="summary-stat">
                <span className="summary-label">Overdue bids:</span>
                <span className="summary-value">
                  {bids.filter(bid => bid.dueDate && new Date(bid.dueDate) < new Date()).length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HuntingData;