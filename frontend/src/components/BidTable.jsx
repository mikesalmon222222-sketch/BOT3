import React, { useState } from 'react';
import { bidsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import './BidTable.css';

const BidTable = ({ bids, pagination, onBidsUpdate }) => {
  const { actions, handleAsync } = useApp();
  const [deletingBid, setDeletingBid] = useState(null);

  const handleDeleteBid = async (bidId, bidTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${bidTitle}"?`)) {
      return;
    }

    setDeletingBid(bidId);
    
    try {
      await handleAsync(async () => {
        await bidsAPI.deleteBid(bidId);
        // Refresh the bids list
        if (onBidsUpdate) {
          onBidsUpdate();
        }
      }, 'Failed to delete bid');
    } catch (error) {
      // Error is handled by handleAsync
    } finally {
      setDeletingBid(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (!bids || bids.length === 0) {
    return (
      <div className="bid-table-container">
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No bids found</h3>
          <p>Try fetching bids from SEPTA or check your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bid-table-container">
      <div className="table-wrapper">
        <table className="bid-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Portal</th>
              <th>Posted Date</th>
              <th>Due Date</th>
              <th>Documents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr key={bid._id} className={isOverdue(bid.dueDate) ? 'overdue' : ''}>
                <td className="title-cell">
                  <div className="title-content">
                    {bid.link ? (
                      <a
                        href={bid.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bid-link"
                        title="Open bid details"
                      >
                        {bid.title}
                      </a>
                    ) : (
                      <span>{bid.title}</span>
                    )}
                    {bid.description && (
                      <div className="description">{bid.description}</div>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`portal-badge portal-${bid.portal.toLowerCase()}`}>
                    {bid.portal}
                  </span>
                </td>
                <td>{formatDate(bid.postedDate)}</td>
                <td className={isOverdue(bid.dueDate) ? 'overdue-date' : ''}>
                  {formatDate(bid.dueDate)}
                  {isOverdue(bid.dueDate) && <span className="overdue-label">OVERDUE</span>}
                </td>
                <td>
                  {bid.documents && bid.documents.length > 0 ? (
                    <div className="documents-list">
                      {bid.documents.map((doc, index) => (
                        <a
                          key={index}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="document-link"
                          title={doc.name}
                        >
                          📄 {doc.name}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="no-documents">No documents</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => handleDeleteBid(bid._id, bid.title)}
                    disabled={deletingBid === bid._id}
                    className="delete-btn"
                    title="Delete bid"
                  >
                    {deletingBid === bid._id ? '⏳' : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => onBidsUpdate(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="pagination-btn"
            >
              ← Previous
            </button>
            <span className="pagination-current">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onBidsUpdate(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="pagination-btn"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BidTable;