#!/usr/bin/env node

/**
 * Script to add sample bid data for testing UI
 */

import { mockDB } from './src/utils/mockDB.js';
import { generateHash } from './src/utils/encryption.js';

const sampleBids = [
  {
    portal: 'SEPTA',
    title: 'RFP-2024-001: IT Services and Support',
    postedDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    amount: '$75,000',
    quantity: '1 contract',
    link: 'https://epsadmin.septa.org/vendor/bid/RFP-2024-001',
    documents: [
      { name: 'Technical Specifications.pdf', url: 'https://epsadmin.septa.org/docs/spec-001.pdf' },
      { name: 'Proposal Template.docx', url: 'https://epsadmin.septa.org/docs/template-001.docx' }
    ],
    externalId: 'RFP-2024-001',
    description: 'Professional IT consulting and support services for SEPTA operations including network management, software support, and technical consulting.',
    status: 'open'
  },
  {
    portal: 'SEPTA',
    title: 'RFQ-2024-002: Office Supplies and Equipment',
    postedDate: new Date('2024-01-20'),
    dueDate: new Date('2024-02-20'),
    amount: '$45,000',
    quantity: 'Multiple items',
    link: 'https://epsadmin.septa.org/vendor/bid/RFQ-2024-002',
    documents: [
      { name: 'Requirements List.pdf', url: 'https://epsadmin.septa.org/docs/req-002.pdf' }
    ],
    externalId: 'RFQ-2024-002',
    description: 'Procurement of office supplies and equipment for administrative facilities including furniture, computers, and general office supplies.',
    status: 'open'
  },
  {
    portal: 'SEPTA',
    title: 'SOL-2024-003: Maintenance Services Contract',
    postedDate: new Date('2024-01-25'),
    dueDate: new Date('2024-02-25'),
    amount: '$95,000',
    quantity: '12 months',
    link: 'https://epsadmin.septa.org/vendor/bid/SOL-2024-003',
    documents: [
      { name: 'Statement of Work.pdf', url: 'https://epsadmin.septa.org/docs/sow-003.pdf' },
      { name: 'Safety Requirements.pdf', url: 'https://epsadmin.septa.org/docs/safety-003.pdf' }
    ],
    externalId: 'SOL-2024-003',
    description: 'Annual maintenance contract for facility equipment and systems including HVAC, electrical, and general facility maintenance services.',
    status: 'open'
  },
  {
    portal: 'SEPTA',
    title: 'RFP-2024-004: Training and Development Services',
    postedDate: new Date('2024-01-30'),
    dueDate: new Date('2024-03-01'),
    amount: '$60,000',
    quantity: '100 employees',
    link: 'https://epsadmin.septa.org/vendor/bid/RFP-2024-004',
    documents: [
      { name: 'Training Plan.pdf', url: 'https://epsadmin.septa.org/docs/training-004.pdf' }
    ],
    externalId: 'RFP-2024-004',
    description: 'Professional training and development services for staff including safety training, technical skills development, and management training.',
    status: 'open'
  },
  {
    portal: 'SEPTA',
    title: 'BID-2024-005: Vehicle Fleet Maintenance',
    postedDate: new Date('2024-02-01'),
    dueDate: new Date('2024-03-15'),
    amount: '$150,000',
    quantity: '50 vehicles',
    link: 'https://epsadmin.septa.org/vendor/bid/BID-2024-005',
    documents: [
      { name: 'Fleet Specifications.pdf', url: 'https://epsadmin.septa.org/docs/fleet-005.pdf' },
      { name: 'Maintenance Schedule.xlsx', url: 'https://epsadmin.septa.org/docs/schedule-005.xlsx' }
    ],
    externalId: 'BID-2024-005',
    description: 'Comprehensive vehicle fleet maintenance services including routine maintenance, repairs, and emergency services for transit vehicles.',
    status: 'open'
  }
];

async function addSampleData() {
  console.log('Adding sample bid data...');
  
  for (const bidData of sampleBids) {
    try {
      // Generate hash for deduplication
      bidData.titleHash = generateHash(bidData.title);
      
      await mockDB.saveBid(bidData);
      console.log(`✅ Added bid: ${bidData.title}`);
    } catch (error) {
      console.error(`❌ Failed to add bid: ${bidData.title}`, error);
    }
  }
  
  console.log('\n🎉 Sample data added successfully!');
  console.log(`Total bids in database: ${(await mockDB.findBids()).total}`);
}

addSampleData().catch(console.error);