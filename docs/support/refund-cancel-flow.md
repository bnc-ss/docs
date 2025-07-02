---
title: "Refund & Cancellation Flow"
description: "How to handle refund and cancellation requests efficiently and empathetically"
sidebar_position: 3
tags: ["refund-cancel-flow", "refund", "cancellation", "returns"]
keywords: ["refund", "cancel", "return", "money back", "cancellation", "exchange"]
synonyms: ["money back", "return order", "cancel purchase", "refund request", "order cancellation"]
ticket_volume: 4
neg_csat_pct: 25.0
ai_hints:
  - "root_cause: product dissatisfaction, order changes, financial constraints"
  - "resolution_time_estimate: 10min"
  - "escalate_if: customer threatens chargeback or legal action"
---

# Refund & Cancellation Flow

## TL;DR
**Tickets**: 4 (7.4%)  
**Risk**: 25.0% negative

## Step-by-Step Resolution

### 1. Acknowledge Request
- Confirm understanding of their refund/cancellation request
- Express empathy without admitting fault
- Gather order details and reason for request

### 2. Assess Eligibility
**Check Refund Policy Criteria**:
- **Time Window**: Within 30 days of purchase
- **Product Condition**: Unopened/unused items
- **Order Status**: Not yet shipped or in transit
- **Special Cases**: Out-of-stock substitutions, quality issues

### 3. Determine Refund Type
**Full Refund**: 
- Unopened items within 30 days
- Out-of-stock substitutions declined
- Quality issues or defects

**Partial Refund**:
- Partially used items
- Restocking fees for opened items
- Shipping costs (if applicable)

**Exchange/Store Credit**:
- Preferred over cash refund when possible
- Maintains customer relationship
- Faster processing

### 4. Process Request
**For Cancellations (Not Yet Shipped)**:
- Cancel order immediately
- Process full refund
- Send confirmation email

**For Returns (Already Shipped)**:
- Provide RMA form and return instructions
- Issue refund upon receipt and inspection
- Cover return shipping if quality issue

### 5. Follow Up
- Send refund confirmation with timeline
- Provide tracking for return shipping (if applicable)
- Check satisfaction after refund completion

## Preventive Guidance

- **Clear Policies**: Ensure refund policy is clearly communicated
- **Quality Control**: Prevent issues that lead to refunds
- **Proactive Communication**: Address concerns before they become refund requests
- **Alternative Solutions**: Offer exchanges or store credit when possible
- **Customer Education**: Help customers make informed purchases

## Canned Reply (LLM can template vars)

> Hi {{customer_name}},
> 
> Thank you for reaching out about your order. I understand you'd like to {{refund_type}} your purchase, and I'm here to help make this process as smooth as possible.
> 
> Based on our refund policy, your request {{eligibility_status}}. {{specific_instructions}}
> 
> {{refund_details}}
> 
> You should see the refund in your account within {{timeline}}. If you have any questions during this process, please don't hesitate to reach out.
> 
> Thank you for giving us the opportunity to serve you, and I hope we can assist you again in the future.
> 
> Best regards,  
> {{agent_name}}  
> BoxNCase Support Team

## Refund / Exchange Eligibility

**Standard 30-Day Policy**:
- Full refund for unopened items within 30 days
- 15% restocking fee for opened items
- No refunds after 30 days (except quality issues)
- Free return shipping for quality issues

**Special Circumstances**:
- **Out-of-Stock Substitutions**: Full refund if customer declines all alternatives
- **Quality Issues**: Full refund regardless of time frame
- **Shipping Delays**: Partial refund for excessive delays
- **Temperature-Sensitive Items**: Special handling for frozen/perishable items

## Escalation

**Contact**: internal@boxncase.com  
**When to Escalate**:
- Customer threatens chargeback or legal action
- High-value refunds (>$500)
- Complex return situations
- Multiple refund requests from same customer
- Disputes about refund policy

## AI Retrieval Notes

- **Keywords**: refund, cancel, return, money back, cancellation
- **Synonyms**: return order, cancel purchase, refund request, order cancellation
- **Avoid**: "unfortunately", "sorry", "apologize" - focus on solution and policy
- **Cross-reference**: [/docs/policies/refund](/docs/policies/refund) for detailed policy
- **Tone**: Professional, empathetic, solution-focused
- **Important**: Always verify order details before processing refunds 