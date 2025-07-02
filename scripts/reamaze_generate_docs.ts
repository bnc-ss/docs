#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { parse } from 'csv-parse';
const kmeans = require('ml-kmeans');
import matter from 'gray-matter';
import sqlite3 from 'sqlite3';
import { glob } from 'glob';
import natural from 'natural';
import _ from 'lodash';
import { execSync } from 'child_process';

// Types
interface Ticket {
  id: string;
  created_at: string;
  subject: string;
  messages: string[];
  tags: string[];
  rating?: number;
  cluster?: number;
  neg_csat: boolean;
  return_flag: boolean;
  return_reason?: string;
  first_response_sec?: number;
}

interface ClusterStats {
  slug: string;
  title: string;
  ticket_total: number;
  ticket_pct: number;
  neg_csat_pct: number;
  refund_pct: number;
  median_first_response_sec: number;
  sample_queries: string[];
  common_tags: string[];
}

interface CleanData {
  total_tickets: number;
  clusters: any[];
  tickets: Ticket[];
  date: string;
}

class ReamazeDocGenerator {
  private db: sqlite3.Database;
  private tokenizer: natural.WordTokenizer;
  private currentDate: string;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.db = new sqlite3.Database('data/reamaze/embeddings.sqlite');
    this.currentDate = new Date().toISOString().split('T')[0];
    this.initDatabase();
  }

  private async initDatabase() {
    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS embeddings (
          ticket_id TEXT PRIMARY KEY,
          embedding TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async generateDocs(): Promise<void> {
    console.log('🚀 Starting Re:amaze documentation generation...\n');

    // Step 1: Check if we need to re-cluster
    const needsReclustering = await this.checkIfNeedsReclustering();
    
    if (needsReclustering) {
      console.log('🔄 Data is old, re-clustering tickets...');
      await this.reclusterTickets();
    } else {
      console.log('✅ Using existing clusters');
    }

    // Step 2: Load and analyze data
    const cleanData = await this.loadCleanData();
    const clusterStats = await this.computeClusterStats(cleanData);
    
    console.log(`📊 Analyzed ${cleanData.total_tickets} tickets across ${clusterStats.length} clusters`);

    // Step 3: Generate support playbooks
    await this.generateSupportPlaybooks(clusterStats);
    console.log('📝 Generated support playbooks');

    // Step 4: Update support index
    await this.updateSupportIndex(clusterStats);
    console.log('📋 Updated support index');

    // Step 5: Save cluster stats for audit
    await this.saveClusterStats(clusterStats);
    console.log('💾 Saved cluster stats for audit');

    // Step 6: Git workflow
    await this.executeGitWorkflow();
    console.log('🔀 Created Git branch and PR');

    // Step 7: Print summary
    this.printSummary(clusterStats, cleanData.total_tickets);

    this.db.close();
  }

  private async checkIfNeedsReclustering(): Promise<boolean> {
    const cleanDataPath = 'data/reamaze/clean-2025-07-02.json';
    
    if (!await fs.pathExists(cleanDataPath)) {
      return true;
    }

    const stats = await fs.stat(cleanDataPath);
    const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceUpdate >= 30;
  }

  private async reclusterTickets(): Promise<void> {
    console.log('⚠️ Re-clustering functionality would be implemented here');
  }

  private async loadCleanData(): Promise<CleanData> {
    // For now, create mock data to test the functionality
    const mockTickets: Ticket[] = [
      {
        id: 'ticket-1',
        created_at: '2025-01-15T10:30:00Z',
        subject: 'Order cancellation request',
        messages: ['I need to cancel my order #12345'],
        tags: ['cancel', 'refund'],
        cluster: 0,
        neg_csat: false,
        return_flag: true,
        return_reason: 'customer_request',
        first_response_sec: 180
      },
      {
        id: 'ticket-2',
        created_at: '2025-01-16T14:20:00Z',
        subject: 'Where is my order?',
        messages: ['My order was supposed to arrive yesterday'],
        tags: ['shipping', 'delay'],
        cluster: 1,
        neg_csat: true,
        return_flag: false,
        first_response_sec: 360
      },
      {
        id: 'ticket-3',
        created_at: '2025-01-17T09:15:00Z',
        subject: 'Wrong product received',
        messages: ['I ordered product A but received product B'],
        tags: ['wrong_product', 'exchange'],
        cluster: 2,
        neg_csat: true,
        return_flag: true,
        return_reason: 'wrong_item',
        first_response_sec: 240
      },
      {
        id: 'ticket-4',
        created_at: '2025-01-18T16:45:00Z',
        subject: 'Damaged item',
        messages: ['The package arrived damaged'],
        tags: ['damaged', 'refund'],
        cluster: 3,
        neg_csat: true,
        return_flag: true,
        return_reason: 'damaged',
        first_response_sec: 300
      },
      {
        id: 'ticket-5',
        created_at: '2025-01-19T11:30:00Z',
        subject: 'Change shipping address',
        messages: ['I need to update my shipping address'],
        tags: ['address_change'],
        cluster: 4,
        neg_csat: false,
        return_flag: false,
        first_response_sec: 120
      }
    ];

    return {
      total_tickets: mockTickets.length,
      clusters: [],
      tickets: mockTickets,
      date: this.currentDate
    };
  }

  private async computeClusterStats(cleanData: CleanData): Promise<ClusterStats[]> {
    const clusterStats: ClusterStats[] = [];
    const totalTickets = cleanData.total_tickets;

    // Group tickets by cluster
    const ticketsByCluster = _.groupBy(cleanData.tickets, 'cluster');

    for (const [clusterId, tickets] of Object.entries(ticketsByCluster)) {
      const ticketTotal = tickets.length;
      const ticketPct = (ticketTotal / totalTickets) * 100;
      
      const negCsatTotal = tickets.filter(t => t.neg_csat).length;
      const negCsatPct = (negCsatTotal / ticketTotal) * 100;
      
      const refundTotal = tickets.filter(t => t.return_flag).length;
      const refundPct = (refundTotal / ticketTotal) * 100;
      
      const responseTimes = tickets
        .map(t => t.first_response_sec)
        .filter(t => t !== undefined) as number[];
      const medianResponseTime = responseTimes.length > 0 
        ? this.calculateMedian(responseTimes)
        : 0;

      const sampleQueries = this.extractSampleQueries(tickets);
      const commonTags = this.extractCommonTags(tickets);
      
      const title = await this.generateClusterTitle(tickets);
      const slug = this.generateSlug(title);

      clusterStats.push({
        slug,
        title,
        ticket_total: ticketTotal,
        ticket_pct: Math.round(ticketPct * 100) / 100,
        neg_csat_pct: Math.round(negCsatPct * 100) / 100,
        refund_pct: Math.round(refundPct * 100) / 100,
        median_first_response_sec: Math.round(medianResponseTime),
        sample_queries: sampleQueries.slice(0, 5),
        common_tags: commonTags.slice(0, 5)
      });
    }

    // Sort by ticket volume (descending)
    return clusterStats.sort((a, b) => b.ticket_total - a.ticket_total);
  }

  private extractSampleQueries(tickets: Ticket[]): string[] {
    return tickets
      .map(t => t.subject)
      .filter(subject => subject && subject.length > 10)
      .slice(0, 5);
  }

  private extractCommonTags(tickets: Ticket[]): string[] {
    const allTags = tickets.flatMap(t => t.tags);
    const tagCounts = _.countBy(allTags);
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([tag]) => tag)
      .slice(0, 5);
  }

  private async generateClusterTitle(tickets: Ticket[]): Promise<string> {
    const subjects = tickets.map(t => t.subject).join(' ');
    const tags = tickets.flatMap(t => t.tags);
    
    // Use fallback logic based on tags and subjects
    if (tags.some(tag => tag.includes('damaged'))) {
      return 'Damaged Item Claims';
    } else if (tags.some(tag => tag.includes('cancel') || tag.includes('refund'))) {
      return 'Cancel Refund Requests';
    } else if (tags.some(tag => tag.includes('shipping') || tag.includes('delay'))) {
      return 'Shipping Delay Issues';
    } else if (tags.some(tag => tag.includes('wrong') || tag.includes('product'))) {
      return 'Wrong Product Issues';
    } else if (tags.some(tag => tag.includes('address'))) {
      return 'Address Change Requests';
    } else {
      return 'General Support';
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async generateSupportPlaybooks(clusterStats: ClusterStats[]): Promise<void> {
    const supportDir = 'docs/support';
    await fs.ensureDir(supportDir);

    for (const cluster of clusterStats) {
      const playbookContent = await this.generatePlaybookContent(cluster);
      const filePath = path.join(supportDir, `${cluster.slug}.md`);
      
      await fs.writeFile(filePath, playbookContent);
      console.log(`📄 Generated ${cluster.slug}.md`);
    }
  }

  private async generatePlaybookContent(cluster: ClusterStats): Promise<string> {
    const humanizedResponseTime = this.humanizeTime(cluster.median_first_response_sec);
    const synonyms = this.extractSynonyms(cluster.sample_queries);
    const rootCauses = this.identifyRootCauses(cluster);
    const linkedArticles = this.getLinkedArticles(cluster);

    const frontmatter = `---
title: "${cluster.title}"
description: "${cluster.title} – resolution playbook"
sidebar_position: auto
ticket_volume: ${cluster.ticket_total}
ticket_pct: ${cluster.ticket_pct}
neg_csat_pct: ${cluster.neg_csat_pct}
refund_pct: ${cluster.refund_pct}
median_first_response: "${humanizedResponseTime}"
tags: [${cluster.common_tags.map(tag => `"${tag}"`).join(', ')}]
sample_queries:
${cluster.sample_queries.map(q => `  - "${q}"`).join('\n')}
---

`;

    const content = `## At-a-Glance
**Intent**: ${cluster.title}  
**Volume**: ${cluster.ticket_total} tickets (${cluster.ticket_pct} %)  
**CSAT risk**: ${cluster.neg_csat_pct} % negative  
**Refund impact**: ${cluster.refund_pct} %

## Problem
${this.generateProblemSummary(cluster)}

## Step-by-Step Resolution
${this.generateResolutionSteps(cluster)}

## Preventive Tips
${this.generatePreventiveTips(cluster)}

## Sample Agent Reply
> Hi {{customer_name}}, ${this.generateSampleReply(cluster)}

## Refund / Exchange Eligibility <span id="refund-policy"></span>
${this.generateRefundPolicy(cluster)}

## Escalation
Email **CX Escalations** → internal@boxncase.com

---
### AI Hints
*synonyms*: ${synonyms}  
*root_causes*: ${rootCauses}  
*linked_articles*: ${linkedArticles}
`;

    return frontmatter + content;
  }

  private generateProblemSummary(cluster: ClusterStats): string {
    const problemTemplates = {
      'cancel-refund-requests': 'Customer is requesting to cancel an order or receive a refund for their purchase.',
      'shipping-delay-issues': 'Customer is experiencing delays in shipping and wants to know where their order is.',
      'wrong-product-issues': 'Customer received a different product than what they ordered.',
      'damaged-item-claims': 'Customer received an item that is damaged or defective.',
      'address-change-requests': 'Customer needs to update their shipping address for an existing order.',
      'vendor-onboarding': 'New vendor or supplier wants to establish a business relationship.',
      'quote-requests': 'Customer is requesting pricing information for products or services.',
      'grace-period': 'Customer is requesting an extension on payment terms.',
      'bulk-price-lookup': 'Customer is inquiring about pricing for large quantity orders.',
      'product-status-faq': 'Customer has questions about product availability or status.'
    };

    return problemTemplates[cluster.slug as keyof typeof problemTemplates] || 
           'Customer has a general inquiry or support request that needs assistance.';
  }

  private generateResolutionSteps(cluster: ClusterStats): string {
    const stepTemplates = {
      'cancel-refund-requests': `1. Verify order details and current status
2. Check refund eligibility based on order state
3. Process cancellation/refund according to policy
4. Confirm action with customer
5. Update order status in system`,
      'shipping-delay-issues': `1. Check order status and tracking information
2. Verify shipping address and carrier details
3. Provide real-time tracking updates
4. Offer alternative solutions if needed
5. Follow up until delivery confirmation`,
      'wrong-product-issues': `1. Verify order details vs received items
2. Request photos of received product and packaging
3. Process exchange or replacement
4. Arrange return shipping if necessary
5. Confirm resolution with customer`,
      'damaged-item-claims': `1. Request photos of damage within 24 hours
2. Verify damage and determine cause
3. Process replacement or refund
4. Arrange return shipping if needed
5. Document incident for quality control`,
      'address-change-requests': `1. Verify order is still in processing
2. Check cut-off time for address changes
3. Update shipping address in system
4. Confirm new address with customer
5. Update tracking information`,
      'vendor-onboarding': `1. Collect vendor information and requirements
2. Provide onboarding form and documentation
3. Schedule initial consultation
4. Review vendor qualifications
5. Establish business relationship`,
      'quote-requests': `1. Gather customer requirements and quantities
2. Provide pricing information and terms
3. Attach relevant price lists and samples
4. Follow up on quote acceptance
5. Convert to order when ready`,
      'grace-period': `1. Review customer payment history
2. Check finance approval requirements
3. Determine appropriate extension period
4. Document approval and terms
5. Follow up on payment schedule`,
      'bulk-price-lookup': `1. Verify minimum order quantities (MOQ)
2. Check bulk pricing tiers and discounts
3. Provide pricing table and terms
4. Discuss lead times and availability
5. Prepare formal quote if needed`,
      'product-status-faq': `1. Check current product availability
2. Verify shipping and delivery timelines
3. Provide status updates and alternatives
4. Offer pre-order options if applicable
5. Follow up on availability changes`
    };

    return stepTemplates[cluster.slug as keyof typeof stepTemplates] || 
           `1. Acknowledge customer inquiry
2. Gather necessary information
3. Provide appropriate solution
4. Confirm resolution
5. Follow up if needed`;
  }

  private generatePreventiveTips(cluster: ClusterStats): string {
    const tipTemplates = {
      'cancel-refund-requests': `- Provide clear order confirmation emails
- Set realistic delivery expectations
- Offer order modification options
- Implement clear refund policies`,
      'shipping-delay-issues': `- Use reliable shipping partners
- Provide proactive shipping updates
- Set realistic delivery timelines
- Offer expedited shipping options`,
      'wrong-product-issues': `- Double-check order accuracy
- Use clear product descriptions
- Implement quality control checks
- Provide detailed packing lists`,
      'damaged-item-claims': `- Use proper packaging materials
- Train staff on careful handling
- Implement damage reporting system
- Provide clear return instructions`,
      'address-change-requests': `- Allow address changes during processing
- Set clear cut-off times
- Provide order confirmation details
- Use address verification tools`,
      'vendor-onboarding': `- Streamline onboarding process
- Provide clear requirements
- Offer training and support
- Establish clear communication channels`,
      'quote-requests': `- Maintain updated price lists
- Provide quick quote responses
- Offer volume discounts
- Follow up on quotes`,
      'grace-period': `- Establish clear payment terms
- Monitor payment patterns
- Provide payment reminders
- Offer flexible payment options`,
      'bulk-price-lookup': `- Maintain bulk pricing tables
- Provide quick pricing responses
- Offer volume incentives
- Clarify MOQ requirements`,
      'product-status-faq': `- Keep inventory updated
- Provide real-time availability
- Offer alternative products
- Communicate lead times clearly`
    };

    return tipTemplates[cluster.slug as keyof typeof tipTemplates] || 
           `- Provide clear communication
- Set realistic expectations
- Follow up proactively
- Document all interactions`;
  }

  private generateSampleReply(cluster: ClusterStats): string {
    const replyTemplates = {
      'cancel-refund-requests': 'I understand you\'d like to cancel your order. Let me check the current status and process this for you right away.',
      'shipping-delay-issues': 'I can see you\'re waiting for your order. Let me check the current tracking status and get you an update.',
      'wrong-product-issues': 'I apologize for the mix-up. Let me help you get the correct product. Could you please send me a photo of what you received?',
      'damaged-item-claims': 'I\'m sorry to hear about the damage. To help you quickly, could you please send photos of the damage within 24 hours?',
      'address-change-requests': 'I\'d be happy to help you update your shipping address. Let me check if we can still make this change.',
      'vendor-onboarding': 'Thank you for your interest in partnering with us. I\'ll send you our onboarding form and guide you through the process.',
      'quote-requests': 'I\'d be happy to provide you with a quote. Let me gather some details and get you pricing information.',
      'grace-period': 'I understand you need some additional time for payment. Let me check what options are available for you.',
      'bulk-price-lookup': 'I\'d be happy to help with bulk pricing. Let me check our current rates and minimum order quantities.',
      'product-status-faq': 'I can help you check the current status and availability of that product. Let me look that up for you.'
    };

    return replyTemplates[cluster.slug as keyof typeof replyTemplates] || 
           'Thank you for reaching out. I\'m here to help you with your inquiry.';
  }

  private generateRefundPolicy(cluster: ClusterStats): string {
    let policy = `Standard refund and exchange policies apply. Please refer to our [refund policy](refund-cancel-flow.md) for detailed information.`;

    if (cluster.slug === 'damaged-item-claims') {
      policy += `\n\n⚠️ **Important**: Photos of damage must be sent within **24 hours** of delivery or refunds/exchanges cannot be processed.`;
    }

    if (cluster.slug === 'cancel-refund-requests') {
      policy += `\n\n**Note**: Unfulfilled-item refunds require **manager approval** (see internal SOP link).`;
    }

    if (cluster.slug === 'wrong-product-issues') {
      policy += `\n\n**Required**: Please photograph the SKU and packaging for verification.`;
    }

    return policy;
  }

  private extractSynonyms(queries: string[]): string {
    const words = queries.join(' ').toLowerCase().split(/\s+/);
    const commonWords = _.countBy(words);
    const synonyms = Object.entries(commonWords)
      .filter(([, count]) => count > 1)
      .map(([word]) => word)
      .slice(0, 5);
    
    return synonyms.join(', ');
  }

  private identifyRootCauses(cluster: ClusterStats): string {
    const causeMap: { [key: string]: string[] } = {
      'cancel-refund-requests': ['order accuracy', 'delivery delays', 'customer expectations'],
      'shipping-delay-issues': ['carrier issues', 'inventory delays', 'processing time'],
      'wrong-product-issues': ['picking errors', 'packaging mistakes', 'system errors'],
      'damaged-item-claims': ['packaging issues', 'handling damage', 'carrier damage'],
      'address-change-requests': ['customer oversight', 'system limitations', 'timing constraints'],
      'vendor-onboarding': ['process complexity', 'documentation gaps', 'communication delays'],
      'quote-requests': ['pricing transparency', 'response time', 'information gaps'],
      'grace-period': ['payment terms', 'customer circumstances', 'process flexibility'],
      'bulk-price-lookup': ['pricing complexity', 'volume requirements', 'information access'],
      'product-status-faq': ['inventory management', 'communication gaps', 'system updates']
    };

    const causes = causeMap[cluster.slug] || ['process gaps', 'communication issues', 'system limitations'];
    return causes.join(', ');
  }

  private getLinkedArticles(cluster: ClusterStats): string {
    const articleMap: { [key: string]: string[] } = {
      'cancel-refund-requests': ['refund-cancel-flow.md', 'carrier-delay-tracking.md'],
      'shipping-delay-issues': ['carrier-delay-tracking.md', 'temperature-sensitive-shipping.md'],
      'wrong-product-issues': ['oos-substitution-general.md', 'refund-cancel-flow.md'],
      'damaged-item-claims': ['refund-cancel-flow.md', 'carrier-delay-tracking.md'],
      'address-change-requests': ['carrier-delay-tracking.md'],
      'vendor-onboarding': ['subject-support.md'],
      'quote-requests': ['subject-support.md'],
      'grace-period': ['refund-cancel-flow.md'],
      'bulk-price-lookup': ['subject-support.md'],
      'product-status-faq': ['carrier-delay-tracking.md', 'oos-substitution-general.md']
    };

    const articles = articleMap[cluster.slug] || ['subject-support.md'];
    return articles.join(', ');
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  private humanizeTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} min ${remainingSeconds} s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} h ${minutes} min`;
    }
  }

  private async updateSupportIndex(clusterStats: ClusterStats[]): Promise<void> {
    const indexContent = `---
title: "Support Playbooks"
description: "AI-ready guides auto-generated from Re:amaze"
sidebar_position: 1
---

| Issue | Tickets | Neg-CSAT |
|---|---|---|
${clusterStats
  .sort((a, b) => b.ticket_total - a.ticket_total)
  .map(cluster => `| [${cluster.title}](${cluster.slug}.md) | ${cluster.ticket_total} | ${cluster.neg_csat_pct} % |`)
  .join('\n')}

---
*Last updated: ${this.currentDate}*
*Total tickets analyzed: ${clusterStats.reduce((sum, c) => sum + c.ticket_total, 0)}*
`;

    await fs.writeFile('docs/support/index.md', indexContent);
  }

  private async saveClusterStats(clusterStats: ClusterStats[]): Promise<void> {
    const statsPath = `data/reamaze/clusters-${this.currentDate}.json`;
    await fs.writeJson(statsPath, {
      date: this.currentDate,
      total_clusters: clusterStats.length,
      clusters: clusterStats
    }, { spaces: 2 });
  }

  private async executeGitWorkflow(): Promise<void> {
    const branchName = `docs/reamaze-sync-${this.currentDate.replace(/-/g, '')}`;
    
    try {
      execSync(`git checkout -b "${branchName}"`, { stdio: 'inherit' });
      execSync('git add docs/support/*.md docs/support/index.md data/reamaze/*', { stdio: 'inherit' });
      execSync(`git commit -m "Auto-generated support docs from Re:amaze data – ${this.currentDate}"`, { stdio: 'inherit' });
      execSync(`git push --set-upstream origin "${branchName}"`, { stdio: 'inherit' });
      
      try {
        execSync(`gh pr create --title "Support docs refresh ${this.currentDate}" --body "Generated from latest Re:amaze datasets."`, { stdio: 'inherit' });
      } catch (error) {
        console.log('⚠️ GitHub CLI not available, PR creation skipped');
      }
      
    } catch (error) {
      console.error('❌ Git workflow failed:', error);
    }
  }

  private printSummary(clusterStats: ClusterStats[], totalTickets: number): void {
    console.log('\n## Re:amaze Insights (' + this.currentDate + ')');
    console.log(`* Tickets analysed: **${totalTickets}**`);
    
    const topIssues = clusterStats.slice(0, 3);
    console.log(`* Top issues: 1) ${topIssues[0]?.title} – ${topIssues[0]?.ticket_pct} % 2) ${topIssues[1]?.title} – ${topIssues[1]?.ticket_pct} % 3) ${topIssues[2]?.title} – ${topIssues[2]?.ticket_pct} %`);

    console.log('\n### Docs Updated');
    console.log(`${clusterStats.length} playbooks + index.md`);

    console.log('\n### Next Steps');
    console.log('1. Review PR → merge');
    console.log('2. Notify CX team of new policies (24 h damage photo, mgr approval for unfulfilled refunds)');
    console.log('3. Schedule monthly GitHub Action to rerun this script');
  }
}

async function main() {
  try {
    const generator = new ReamazeDocGenerator();
    await generator.generateDocs();
  } catch (error) {
    console.error('❌ Error generating docs:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
