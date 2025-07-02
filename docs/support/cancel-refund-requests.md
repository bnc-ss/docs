---
title: "Cancel Refund Requests"
description: "Cancel Refund Requests – resolution playbook"
sidebar_position: auto
ticket_volume: 1
ticket_pct: 20
neg_csat_pct: 0
refund_pct: 100
median_first_response: "3 min 0 s"
tags: ["cancel", "refund"]
sample_queries:
  - "Order cancellation request"
---

## At-a-Glance
**Intent**: Cancel Refund Requests  
**Volume**: 1 tickets (20 %)  
**CSAT risk**: 0 % negative  
**Refund impact**: 100 %

## Problem
Customer is requesting to cancel an order or receive a refund for their purchase.

## Step-by-Step Resolution
1. Verify order details and current status
2. Check refund eligibility based on order state
3. Process cancellation/refund according to policy
4. Confirm action with customer
5. Update order status in system

## Preventive Tips
- Provide clear order confirmation emails
- Set realistic delivery expectations
- Offer order modification options
- Implement clear refund policies

## Sample Agent Reply
> Hi {{customer_name}}, I understand you'd like to cancel your order. Let me check the current status and process this for you right away.

## Refund / Exchange Eligibility <span id="refund-policy"></span>
Standard refund and exchange policies apply. Please refer to our [refund policy](refund-cancel-flow.md) for detailed information.

**Note**: Unfulfilled-item refunds require **manager approval** (see internal SOP link).

## Escalation
Email **CX Escalations** → internal@boxncase.com

---
### AI Hints
*synonyms*:   
*root_causes*: order accuracy, delivery delays, customer expectations  
*linked_articles*: refund-cancel-flow.md, carrier-delay-tracking.md
