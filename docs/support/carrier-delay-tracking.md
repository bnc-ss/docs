---
title: "Carrier Delay & Tracking"
description: "How to handle shipping delays and tracking issues with carriers"
sidebar_position: 5
tags: ["carrier-delay-tracking", "shipping", "delays", "tracking", "carrier"]
keywords: ["shipping delay", "tracking", "carrier", "delivery", "package", "transit"]
synonyms: ["delivery delay", "package tracking", "shipping issue", "transit problem", "carrier issue"]
ticket_volume: 8
neg_csat_pct: 12.5
ai_hints:
  - "root_cause: weather conditions, carrier capacity, routing issues, customs delays"
  - "resolution_time_estimate: 15min"
  - "escalate_if: delay exceeds 5 business days or customer threatens chargeback"
---

# Carrier Delay & Tracking

## TL;DR
**Tickets**: 8 (14.8%)  
**Risk**: 12.5% negative

## Step-by-Step Resolution

### 1. Verify Current Status
**Check Multiple Sources**:
- Carrier tracking website
- Internal shipping system
- Customer's tracking number
- Last known location and status

### 2. Assess Delay Severity
**Delay Categories**:
- **Minor Delay**: 1-2 business days behind schedule
- **Moderate Delay**: 3-5 business days behind schedule
- **Major Delay**: 5+ business days or lost package
- **Weather/Disaster**: Regional or national disruptions

### 3. Communicate with Customer
**Proactive Communication**:
- Acknowledge the delay immediately
- Provide current status and expected delivery
- Explain reason for delay if known
- Offer self-service tracking options

### 4. Provide Solutions
**Based on Delay Type**:
- **Minor Delay**: Provide updated timeline and tracking
- **Moderate Delay**: Offer expedited shipping on next order
- **Major Delay**: Consider replacement or refund
- **Lost Package**: File claim and send replacement

### 5. Follow Up
- Monitor tracking until delivery
- Confirm delivery completion
- Check customer satisfaction
- Document for process improvement

## Preventive Guidance

- **Carrier Relationships**: Maintain relationships with multiple carriers
- **Weather Monitoring**: Check weather conditions along shipping routes
- **Proactive Communication**: Notify customers of known delays
- **Alternative Routes**: Have backup shipping options available
- **Quality Control**: Verify tracking numbers and addresses

## Canned Reply (LLM can template vars)

> Hi {{customer_name}},
> 
> Thank you for reaching out about your order. I can see that your package is currently experiencing a {{delay_type}} with {{carrier_name}}.
> 
> **Current Status**: {{current_status}}  
> **Expected Delivery**: {{expected_delivery}}  
> **Tracking Number**: {{tracking_number}}
> 
> You can track your package here: {{tracking_link}}
> 
> {{delay_explanation}}
> 
> {{compensation_offer}}
> 
> I'll continue to monitor your shipment and will update you if there are any changes. If you have any questions, please don't hesitate to reach out.
> 
> Best regards,  
> {{agent_name}}  
> BoxNCase Support Team

## Refund / Exchange Eligibility

**Delay-Related Refunds**:
- **Minor Delays**: No refund, but expedited shipping on next order
- **Moderate Delays**: Partial refund or store credit
- **Major Delays**: Full refund or replacement
- **Lost Packages**: Full refund or replacement with expedited shipping

**Standard Policy**: Refer to [/docs/policies/shipping](/docs/policies/shipping) for detailed SLA tables.

## Escalation

**Contact**: internal@boxncase.com  
**When to Escalate**:
- Delay exceeds 5 business days
- Customer threatens chargeback or legal action
- High-value orders with significant delays
- Multiple delays with same customer
- Carrier disputes or claims

## AI Retrieval Notes

- **Keywords**: shipping delay, tracking, carrier, delivery, package, transit
- **Synonyms**: delivery delay, package tracking, shipping issue, transit problem
- **Cross-reference**: [/docs/policies/shipping](/docs/policies/shipping) for SLA tables
- **Self-Service**: Always provide tracking link for customer convenience
- **Tone**: Proactive, informative, solution-focused
- **Important**: Never promise specific delivery dates during delays 