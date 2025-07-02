#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { parse } from 'csv-parse';
import OpenAI from 'openai';
const kmeans = require('ml-kmeans');
import matter from 'gray-matter';
import sqlite3 from 'sqlite3';
import { glob } from 'glob';
import natural from 'natural';
import _ from 'lodash';

// Types
interface Ticket {
  id: string;
  subject: string;
  messages: string;
  tags: string[];
  rating?: number;
  created_at: string;
  return_reason?: string;
  staff_name: string;
  staff_email: string;
  conversation_url: string;
  message_type: string;
  brand: string;
  channel: string;
  conversation_origin: string;
}

interface Cluster {
  id: number;
  tickets: Ticket[];
  centroid: number[];
  ticket_total: number;
  ticket_pct: number;
  neg_csat_total: number;
  neg_csat_pct: number;
  refund_return_total: number;
  refund_return_pct: number;
  common_tags: string[];
  sample_queries: string[];
  knowledge_gap: boolean;
  name: string;
}

interface AnalysisResult {
  total_tickets: number;
  clusters: Cluster[];
  avg_csat: number;
  return_rate: number;
  date: string;
}

class ReamazeAnalyzer {
  private openai: OpenAI;
  private db: sqlite3.Database;
  private tokenizer: natural.WordTokenizer;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.tokenizer = new natural.WordTokenizer();
    this.db = new sqlite3.Database('data/reamaze/embeddings.sqlite');
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

  async analyze(): Promise<void> {
    console.log('🚀 Starting Re:amaze ticket analysis...\n');

    // Step 1: Data Prep
    const tickets = await this.loadAndNormalizeData();
    console.log(`📊 Loaded ${tickets.length} tickets`);

    // Step 2: Create embeddings
    const embeddings = await this.createEmbeddings(tickets);
    console.log(`🔍 Created embeddings for ${embeddings.length} tickets`);

    // Step 3: Cluster analysis
    const clusters = await this.clusterTickets(embeddings, tickets);
    console.log(`🎯 Created ${clusters.length} clusters`);

    // Step 4: Generate playbooks
    await this.generatePlaybooks(clusters);
    console.log('📝 Generated support playbooks');

    // Step 5: Update index
    await this.updateSupportIndex(clusters);
    console.log('📋 Updated support index');

    // Step 6: Save analysis results
    await this.saveAnalysisResults(clusters, tickets);
    console.log('💾 Saved analysis results');

    // Step 7: Console summary
    this.printSummary(clusters, tickets);

    this.db.close();
  }

  private async loadAndNormalizeData(): Promise<Ticket[]> {
    const csvFiles = await glob('data/reamaze/*.csv');
    const tickets: Ticket[] = [];

    for (const file of csvFiles) {
      console.log(`📁 Processing ${file}...`);
      
      const fileContent = await fs.readFile(file, 'utf-8');
      const records = await this.parseCSV(fileContent);
      
      for (const record of records) {
        const ticket: Ticket = {
          id: this.generateTicketId(record),
          subject: this.extractSubject(record.Message_Body || ''),
          messages: record.Message_Body || '',
          tags: this.parseTags(record.Conversation_Tags || ''),
          rating: this.parseRating(record),
          created_at: record.Message_Timestamp || '',
          return_reason: this.extractReturnReason(record.Message_Body || ''),
          staff_name: record.Staff_Name || '',
          staff_email: record.Staff_Email || '',
          conversation_url: record.Conversation_URL || '',
          message_type: record.Message_Type || '',
          brand: record.Brand || '',
          channel: record.Channel || '',
          conversation_origin: record.Conversation_Origin || ''
        };
        
        tickets.push(ticket);
      }
    }

    return tickets;
  }

  private async parseCSV(content: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }

  private generateTicketId(record: any): string {
    const url = record.Conversation_URL || '';
    const match = url.match(/conversations\/([^\/]+)/);
    return match ? match[1] : `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractSubject(messageBody: string): string {
    const lines = messageBody.split('\n');
    const firstLine = lines[0].trim();
    return firstLine.length > 0 ? firstLine : 'No subject';
  }

  private parseTags(tagsString: string): string[] {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  private parseRating(record: any): number | undefined {
    // Extract rating from message body or tags if available
    const messageBody = record.Message_Body || '';
    const ratingMatch = messageBody.match(/rating[:\s]*(\d+)/i);
    return ratingMatch ? parseInt(ratingMatch[1]) : undefined;
  }

  private extractReturnReason(messageBody: string): string | undefined {
    const returnKeywords = ['return', 'refund', 'cancel', 'exchange'];
    const hasReturn = returnKeywords.some(keyword => 
      messageBody.toLowerCase().includes(keyword)
    );
    return hasReturn ? 'return_requested' : undefined;
  }

  private async createEmbeddings(tickets: Ticket[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const ticket of tickets) {
      const embedding = await this.getOrCreateEmbedding(ticket);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  private async getOrCreateEmbedding(ticket: Ticket): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT embedding FROM embeddings WHERE ticket_id = ?',
        [ticket.id],
        async (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row && row.embedding) {
            resolve(JSON.parse(row.embedding));
          } else {
            try {
              const embedding = await this.createEmbedding(ticket);
              this.db.run(
                'INSERT INTO embeddings (ticket_id, embedding) VALUES (?, ?)',
                [ticket.id, JSON.stringify(embedding)]
              );
              resolve(embedding);
            } catch (error) {
              reject(error);
            }
          }
        }
      );
    });
  }

  private async createEmbedding(ticket: Ticket): Promise<number[]> {
    const text = `${ticket.subject} ${ticket.messages}`.substring(0, 8000);
    
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }

  private async clusterTickets(embeddings: number[][], tickets: Ticket[]): Promise<Cluster[]> {
    const k = Math.min(20, Math.max(5, Math.floor(tickets.length / 10)));
    const result = kmeans(embeddings, k, { maxIterations: 100 });
    
    const clusters: Cluster[] = [];
    const totalTickets = tickets.length;
    
    for (let i = 0; i < k; i++) {
      const clusterTickets = tickets.filter((_, index) => result.clusters[index] === i);
      
      if (clusterTickets.length === 0) continue;
      
      const cluster: Cluster = {
        id: i,
        tickets: clusterTickets,
        centroid: result.centroids[i],
        ticket_total: clusterTickets.length,
        ticket_pct: (clusterTickets.length / totalTickets) * 100,
        neg_csat_total: clusterTickets.filter(t => t.rating && t.rating < 3).length,
        neg_csat_pct: 0,
        refund_return_total: clusterTickets.filter(t => t.return_reason).length,
        refund_return_pct: 0,
        common_tags: this.getCommonTags(clusterTickets),
        sample_queries: this.getSampleQueries(clusterTickets),
        knowledge_gap: false,
        name: ''
      };
      
      cluster.neg_csat_pct = cluster.neg_csat_total > 0 ? 
        (cluster.neg_csat_total / clusterTickets.length) * 100 : 0;
      cluster.refund_return_pct = (cluster.refund_return_total / clusterTickets.length) * 100;
      
      // Generate cluster name using TF-IDF
      cluster.name = await this.generateClusterName(clusterTickets);
      
      // Check for knowledge gap
      cluster.knowledge_gap = clusterTickets.length >= 10 && 
        !this.checkExistingDocumentation(cluster.name);
      
      clusters.push(cluster);
    }
    
    // Sort by ticket volume
    return clusters.sort((a, b) => b.ticket_total - a.ticket_total);
  }

  private getCommonTags(tickets: Ticket[]): string[] {
    const tagCounts: { [key: string]: number } = {};
    
    tickets.forEach(ticket => {
      ticket.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  private getSampleQueries(tickets: Ticket[]): string[] {
    return tickets
      .map(t => t.subject)
      .filter(subject => subject.length > 10)
      .slice(0, 5);
  }

  private async generateClusterName(tickets: Ticket[]): Promise<string> {
    // Extract meaningful keywords from ticket content
    const allTexts = tickets.map(t => `${t.subject} ${t.messages}`).join(' ');
    const lowerText = allTexts.toLowerCase();
    
    // Check for specific patterns in the data
    if (lowerText.includes('out of stock') || lowerText.includes('backorder') || lowerText.includes('unavailable')) {
      return 'Inventory Issues';
    }
    
    if (lowerText.includes('order') && (lowerText.includes('update') || lowerText.includes('shipping'))) {
      return 'Order Updates';
    }
    
    if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('billing')) {
      return 'Pricing & Billing';
    }
    
    if (lowerText.includes('return') || lowerText.includes('refund') || lowerText.includes('cancel')) {
      return 'Returns & Refunds';
    }
    
    if (lowerText.includes('credit card') || lowerText.includes('payment') || lowerText.includes('authorization')) {
      return 'Payment Processing';
    }
    
    if (lowerText.includes('substitute') || lowerText.includes('replacement') || lowerText.includes('alternative')) {
      return 'Product Substitutions';
    }
    
    if (lowerText.includes('shipping') || lowerText.includes('delivery') || lowerText.includes('overnight')) {
      return 'Shipping & Delivery';
    }
    
    // Define common support themes and their keywords
    const themes = {
      'Order Updates': ['order', 'update', 'shipping', 'delivery', 'tracking'],
      'Inventory Issues': ['out of stock', 'backorder', 'unavailable', 'substitute', 'replacement'],
      'Pricing & Billing': ['price', 'cost', 'billing', 'payment', 'charge', 'fee'],
      'Product Information': ['product', 'item', 'details', 'specifications', 'features'],
      'Returns & Refunds': ['return', 'refund', 'cancel', 'exchange', 'refund'],
      'Account Issues': ['account', 'login', 'password', 'profile', 'settings'],
      'Shipping Problems': ['shipping', 'delivery', 'tracking', 'package', 'carrier'],
      'Quality Issues': ['quality', 'defective', 'damaged', 'broken', 'issue'],
      'General Support': ['help', 'support', 'question', 'inquiry', 'assistance']
    };
    
    // Score each theme based on keyword frequency
    const themeScores: { [key: string]: number } = {};
    Object.entries(themes).forEach(([theme, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          score += matches.length;
        }
      });
      themeScores[theme] = score;
    });
    
    // Find the highest scoring theme
    const bestTheme = Object.entries(themeScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (bestTheme && bestTheme[1] > 0) {
      return bestTheme[0];
    }
    
    // Fallback: extract common words and create a descriptive name
    const tokens = this.tokenizer.tokenize(lowerText) || [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs']);
    
    const wordFreq: { [key: string]: number } = {};
    tokens.forEach(token => {
      if (token && token.length > 3 && !stopWords.has(token)) {
        wordFreq[token] = (wordFreq[token] || 0) + 1;
      }
    });
    
    const sortedWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([word]) => word);
    
    if (sortedWords.length > 0) {
      return sortedWords.join(' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Support';
    }
    
    return 'General Support';
  }

  private checkExistingDocumentation(clusterName: string): boolean {
    // Check if documentation exists for this cluster
    const supportDir = 'docs/support';
    const files = fs.readdirSync(supportDir, { withFileTypes: true });
    
    return files.some(file => 
      file.isFile() && 
      file.name.endsWith('.md') && 
      file.name.toLowerCase().includes(clusterName.toLowerCase().replace(/\s+/g, '-'))
    );
  }

  private async generatePlaybooks(clusters: Cluster[]): Promise<void> {
    for (const cluster of clusters) {
      const playbook = await this.generatePlaybookContent(cluster);
      const filename = this.generateSlug(cluster.name);
      const filepath = `docs/support/${filename}.md`;
      
      await fs.writeFile(filepath, playbook);
    }
  }

  private async generatePlaybookContent(cluster: Cluster): Promise<string> {
    const content = `---
title: "${cluster.name}"
description: "Resolution guide for ${cluster.name.toLowerCase()} issues."
sidebar_position: ${cluster.id + 1}
tags: [${cluster.common_tags.map(tag => `"${tag}"`).join(', ')}]
ticket_volume: ${cluster.ticket_total}
neg_csat_pct: ${cluster.neg_csat_pct.toFixed(1)}
return_pct: ${cluster.refund_return_pct.toFixed(1)}
sample_queries:
${cluster.sample_queries.map(q => `  - "${q}"`).join('\n')}
---

# ${cluster.name}

## At-a-Glance

- **Intent**: ${cluster.name}
- **Volume**: ${cluster.ticket_total} tickets (${cluster.ticket_pct.toFixed(1)}%)
- **CSAT risk**: ${cluster.neg_csat_pct.toFixed(1)}% negative
- **Returns**: ${cluster.refund_return_pct.toFixed(1)}%

## Problem

${this.generateProblemSummary(cluster)}

## Step-by-Step Resolution

${this.generateResolutionSteps(cluster)}

## Preventive Tips

${this.generatePreventiveTips(cluster)}

## Sample Agent Reply

Hi {{customer_name}},

${this.generateSampleReply(cluster)}

Best regards,  
BoxNCase Support Team

## Refund / Exchange Eligibility

${this.generateRefundInfo(cluster)}

## Escalation

Contact CX Escalations – internal@boxncase.com

## AI Hints

- **synonyms**: ${this.generateSynonyms(cluster)}
- **root_causes**: ${this.generateRootCauses(cluster)}
- **linked_articles**: ${this.generateLinkedArticles(cluster)}
`;

    return content;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private generateProblemSummary(cluster: Cluster): string {
    const commonThemes = this.extractCommonThemes(cluster.tickets);
    const rootCauses = this.identifyRootCauses(cluster.tickets);
    const clusterName = cluster.name.toLowerCase();
    
    if (clusterName.includes('order')) {
      return `Customers frequently need updates on their order status, shipping information, or delivery tracking. These inquiries often arise from lack of communication about order progress or unexpected delays in fulfillment.`;
    } else if (clusterName.includes('inventory')) {
      return `Customers encounter out-of-stock items or backorder situations that require immediate attention. These issues typically stem from supply chain challenges or high demand for popular products.`;
    } else if (clusterName.includes('pricing') || clusterName.includes('billing')) {
      return `Customers have questions about pricing, billing, or payment processing. These concerns often relate to unclear pricing structures, unexpected charges, or payment method issues.`;
    } else if (clusterName.includes('return') || clusterName.includes('refund')) {
      return `Customers request returns, refunds, or exchanges for various reasons. These requests typically involve product dissatisfaction, shipping errors, or order modifications.`;
    } else if (clusterName.includes('shipping')) {
      return `Customers experience shipping delays, tracking issues, or delivery problems. These challenges often result from carrier issues, address problems, or weather-related delays.`;
    } else {
      return `Customers frequently experience issues related to ${commonThemes.join(', ')}. These problems often stem from ${rootCauses} and can impact customer satisfaction and order fulfillment.`;
    }
  }

  private generateResolutionSteps(cluster: Cluster): string {
    const steps = [
      "1. **Acknowledge the issue** - Express understanding and empathy",
      "2. **Gather necessary information** - Order details, customer preferences",
      "3. **Provide clear solution** - Offer alternatives or next steps",
      "4. **Follow up** - Ensure resolution and customer satisfaction"
    ];
    return steps.join('\n\n');
  }

  private generatePreventiveTips(cluster: Cluster): string {
    return [
      "- Proactively communicate inventory status",
      "- Provide clear product alternatives",
      "- Set realistic delivery expectations",
      "- Offer flexible solutions for out-of-stock items"
    ].join('\n');
  }

  private generateSampleReply(cluster: Cluster): string {
    const sampleTicket = cluster.tickets[0];
    return `Thank you for reaching out regarding your order. I understand your concern and I'm here to help resolve this issue promptly. Let me assist you with finding the best solution for your needs.`;
  }

  private generateRefundInfo(cluster: Cluster): string {
    return "Please refer to our [refund policy](/docs/policies/refund) for detailed information about eligibility and processing times.";
  }

  private generateSynonyms(cluster: Cluster): string {
    const words = cluster.name.toLowerCase().split(' ');
    return words.join(', ');
  }

  private generateRootCauses(cluster: Cluster): string {
    return "inventory management, supplier delays, customer preferences";
  }

  private generateLinkedArticles(cluster: Cluster): string {
    return "[/docs/support/order-updates](/docs/support/order-updates), [/docs/support/inventory](/docs/support/inventory)";
  }

  private extractCommonThemes(tickets: Ticket[]): string[] {
    const themes: string[] = [];
    const texts = tickets.map(t => t.messages.toLowerCase());
    
    if (texts.some(t => t.includes('out of stock') || t.includes('backorder'))) {
      themes.push('inventory issues');
    }
    if (texts.some(t => t.includes('shipping') || t.includes('delivery'))) {
      themes.push('shipping concerns');
    }
    if (texts.some(t => t.includes('price') || t.includes('cost'))) {
      themes.push('pricing questions');
    }
    
    return themes.length > 0 ? themes : ['general inquiries'];
  }

  private identifyRootCauses(tickets: Ticket[]): string {
    const causes: string[] = [];
    const texts = tickets.map(t => t.messages.toLowerCase());
    
    if (texts.some(t => t.includes('supplier') || t.includes('vendor'))) {
      causes.push('supplier delays');
    }
    if (texts.some(t => t.includes('inventory') || t.includes('stock'))) {
      causes.push('inventory management');
    }
    
    return causes.length > 0 ? causes.join(', ') : 'various operational factors';
  }

  private async updateSupportIndex(clusters: Cluster[]): Promise<void> {
    const content = `---
title: "Support Playbooks"
description: "AI-ready support playbooks generated from customer tickets"
---

# Support Playbooks

This section contains AI-ready support playbooks generated from analysis of customer support tickets.

## Playbooks by Volume

${clusters.map(cluster => 
  `- **[${cluster.name}](/docs/support/${this.generateSlug(cluster.name)})** - ${cluster.ticket_total} tickets (${cluster.ticket_pct.toFixed(1)}%)`
).join('\n')}

## Quick Stats

- **Total Tickets Analyzed**: ${clusters.reduce((sum, c) => sum + c.ticket_total, 0)}
- **Average CSAT**: ${(clusters.reduce((sum, c) => sum + c.neg_csat_pct, 0) / clusters.length).toFixed(1)}%
- **Return Rate**: ${(clusters.reduce((sum, c) => sum + c.refund_return_pct, 0) / clusters.length).toFixed(1)}%

## Knowledge Gaps

${clusters.filter(c => c.knowledge_gap).map(cluster => 
  `- **${cluster.name}** - ${cluster.ticket_total} tickets need documentation`
).join('\n')}
`;

    await fs.writeFile('docs/support/index.md', content);
  }

  private async saveAnalysisResults(clusters: Cluster[], tickets: Ticket[]): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const result: AnalysisResult = {
      total_tickets: tickets.length,
      clusters: clusters.map(c => ({
        ...c,
        tickets: [] // Don't include full ticket data in JSON
      })),
      avg_csat: clusters.reduce((sum, c) => sum + c.neg_csat_pct, 0) / clusters.length,
      return_rate: clusters.reduce((sum, c) => sum + c.refund_return_pct, 0) / clusters.length,
      date
    };

    await fs.writeFile(
      `data/reamaze/clean-${date}.json`,
      JSON.stringify(result, null, 2)
    );
  }

  private printSummary(clusters: Cluster[], tickets: Ticket[]): void {
    const date = new Date().toISOString().split('T')[0];
    const totalTickets = tickets.length;
    const avgCsat = clusters.reduce((sum, c) => sum + c.neg_csat_pct, 0) / clusters.length;
    const returnRate = clusters.reduce((sum, c) => sum + c.refund_return_pct, 0) / clusters.length;

    console.log('\n📊 Re:amaze Insights (' + date + ')');
    console.log(`Tickets analysed: ${totalTickets}`);
    console.log('\nTop issues:');
    
    clusters.slice(0, 5).forEach(cluster => {
      console.log(`${cluster.name} – ${cluster.ticket_pct.toFixed(1)}%`);
    });
    
    console.log(`\nAvg. CSAT: ${avgCsat.toFixed(1)}% | Return rate: ${returnRate.toFixed(1)}%`);
    console.log('\nDocs updated:');
    console.log(`${clusters.length} playbooks`);
    console.log('support index');
    console.log('\nNext steps: review PR ▸ merge ▸ notify CX team ▸ schedule monthly rerun.');
  }
}

// Main execution
async function main() {
  try {
    const analyzer = new ReamazeAnalyzer();
    await analyzer.analyze();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 