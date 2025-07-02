# Re:amaze Support Playbook Auto-Generation System

## Overview

This system automatically generates AI-ready support playbooks from Re:amaze ticket data, enabling AI agents to resolve 90% of repetitive tickets while respecting strict refund policies.

## 🎯 Mission

**Auto-generate & update support playbooks so AI agents resolve 90% of repetitive tickets while respecting strict refund policies.**

## 📁 System Architecture

### Data Flow
```
Re:amaze CSV Exports → Data Processing → Clustering → Playbook Generation → Git Workflow
```

### Key Components

1. **Data Input**: `data/reamaze/clean-{DATE}.json`
2. **Analysis Engine**: `scripts/reamaze_generate_docs.ts`
3. **Output**: `docs/support/*.md` playbooks
4. **Audit Trail**: `data/reamaze/clusters-{DATE}.json`

## 🔬 Analysis Process

### 1. Data Validation
- Check if `clean-{DATE}.json` is ≥ 30 days old
- Re-cluster tickets with embeddings if needed
- Load existing clusters if data is fresh

### 2. Cluster Statistics Computation
For each cluster, compute:
```typescript
{
  slug: string,
  title: string,
  ticket_total: number,
  ticket_pct: number,
  neg_csat_pct: number,
  refund_pct: number,
  median_first_response_sec: number,
  sample_queries: string[],
  common_tags: string[]
}
```

### 3. Priority Clusters with Special Policies

| Cluster Type | Special Policy Injection |
|--------------|-------------------------|
| `cancel-refund` | Manager approval for unfulfilled refunds |
| `shipping-delay-wismo` | Carrier API self-service steps |
| `wrong-product` | Photo verification requirements |
| `damaged-item` | **24-hour photo deadline** |
| `address-change` | Cut-off time reminders |
| `vendor-onboarding` | Onboarding form links |
| `quote-requests` | Price list attachments |
| `grace-period` | Finance approval path |
| `bulk-price-lookup` | MOQ table embedding |
| `product-status-faq` | Merged into shipping-delay |

## 📄 Document Generation

### Playbook Structure
Each playbook includes:

1. **Frontmatter**: Metadata, statistics, tags
2. **At-a-Glance**: Intent, volume, CSAT risk, refund impact
3. **Problem**: Empathetic 2-sentence summary
4. **Step-by-Step Resolution**: 5-step process
5. **Preventive Tips**: Proactive measures
6. **Sample Agent Reply**: Template response
7. **Refund Policy**: With special overrides
8. **Escalation**: Contact information
9. **AI Hints**: Synonyms, root causes, linked articles

### Special Policy Injections

#### Damaged Items
```
⚠️ **Important**: Photos of damage must be sent within **24 hours** 
of delivery or refunds/exchanges cannot be processed.
```

#### Cancel/Refund
```
**Note**: Unfulfilled-item refunds require **manager approval** 
(see internal SOP link).
```

#### Wrong Product
```
**Required**: Please photograph the SKU and packaging for verification.
```

## 🛠 Implementation Details

### Scripts

#### `npm run reamaze:docs`
Main script that orchestrates the entire workflow:
- Data validation and clustering
- Playbook generation
- Index updates
- Git workflow
- Audit trail creation

#### `npm run reamaze:analyze`
Legacy analysis script for data processing and clustering.

### Dependencies
```json
{
  "csv-parse": "^5.5.3",
  "openai": "^4.28.0",
  "ml-kmeans": "^5.0.0",
  "gray-matter": "^4.0.3",
  "sqlite3": "^5.1.6",
  "fs-extra": "^11.2.0",
  "glob": "^10.3.10",
  "natural": "^6.10.4",
  "lodash": "^4.17.21"
}
```

## 🔀 Git Workflow

### Automated Process
1. Create branch: `docs/reamaze-sync-{YYYYMMDD}`
2. Add generated files
3. Commit with descriptive message
4. Push to remote
5. Create PR via GitHub CLI

### Branch Naming
```
docs/reamaze-sync-20250702
```

### Commit Message
```
Auto-generated support docs from Re:amaze data – 2025-07-02
```

## 📊 Output Examples

### Generated Playbooks
- `cancel-refund-requests.md`
- `shipping-delay-issues.md`
- `wrong-product-issues.md`
- `damaged-item-claims.md`
- `address-change-requests.md`

### Support Index
```markdown
| Issue | Tickets | Neg-CSAT |
|---|---|---|
| [Cancel Refund Requests](cancel-refund-requests.md) | 1 | 0 % |
| [Shipping Delay Issues](shipping-delay-issues.md) | 1 | 100 % |
| [Wrong Product Issues](wrong-product-issues.md) | 1 | 100 % |
| [Damaged Item Claims](damaged-item-claims.md) | 1 | 100 % |
| [Address Change Requests](address-change-requests.md) | 1 | 0 % |
```

### Cluster Statistics
```json
{
  "date": "2025-07-02",
  "total_clusters": 5,
  "clusters": [
    {
      "slug": "damaged-item-claims",
      "title": "Damaged Item Claims",
      "ticket_total": 1,
      "ticket_pct": 20,
      "neg_csat_pct": 100,
      "refund_pct": 100,
      "median_first_response_sec": 300,
      "sample_queries": ["Damaged item"],
      "common_tags": ["damaged", "refund"]
    }
  ]
}
```

## 🚀 Usage

### First Time Setup
```bash
cd docs
npm install
npm run reamaze:docs
```

### Regular Updates
```bash
npm run reamaze:docs
```

### Manual Data Processing
```bash
npm run reamaze:analyze
```

## 📈 Success Metrics

### Target Outcomes
- **90% ticket resolution** by AI agents
- **Reduced CSAT risk** through proactive policies
- **Consistent refund handling** with policy enforcement
- **Automated documentation** updates

### Key Performance Indicators
- Ticket volume per cluster
- Negative CSAT percentage
- Refund impact percentage
- Median first response time
- Policy compliance rate

## 🔄 Maintenance

### Monthly Tasks
1. Run `npm run reamaze:docs`
2. Review generated PR
3. Merge approved changes
4. Notify CX team of policy updates

### Quarterly Reviews
1. Analyze cluster effectiveness
2. Update policy templates
3. Optimize resolution steps
4. Review AI hint accuracy

## 🛡️ Policy Compliance

### Critical Policies
1. **24-hour damage photo requirement**
2. **Manager approval for unfulfilled refunds**
3. **Photo verification for wrong products**
4. **Address change cut-off times**

### Enforcement
- Automatic policy injection in playbooks
- Clear escalation paths
- Audit trail maintenance
- Regular policy reviews

## 🔗 Integration Points

### Existing Systems
- Re:amaze ticket exports
- GitHub repository
- Support documentation
- CX team workflows

### Future Enhancements
- Real-time data processing
- AI model training integration
- Automated policy updates
- Performance analytics dashboard

## 📝 Documentation Standards

### Playbook Quality
- Clear, actionable steps
- Empathetic tone
- Policy compliance
- AI-ready formatting

### Maintenance
- Version control
- Change tracking
- Performance monitoring
- Regular audits

---

## 🎉 Implementation Status

✅ **Complete**: Core system implementation  
✅ **Complete**: Mock data testing  
✅ **Complete**: Playbook generation  
✅ **Complete**: Git workflow  
✅ **Complete**: Policy injection  
🔄 **In Progress**: Real data integration  
⏳ **Pending**: Monthly automation  
⏳ **Pending**: Performance monitoring  

---

*Last updated: 2025-07-02*  
*System version: 1.0.0* 