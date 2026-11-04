/**
 * The PRD Markdown reader on a document written the way people write one:
 * group headings, bare names, `- Label: value` lists, label aliases, a first
 * paragraph standing for the main text, stories and steps as nested lists —
 * and a stray paragraph the reader must report rather than drop.
 */
import { describe, expect, it } from 'vitest';
import { read, write, codecFor } from '../src/formats/index.js';
import type { PrdDocument } from '../src/formats/prd/model.js';

const loose = `---
specy: prd
---

# product Sniplink

A URL shortener that unifies link sharing, click analytics and bookmark management.

## Scope

- Shorten a URL: paste, get a short link
- Per-channel click analytics

## Out of scope

- A mobile app for v1

## Problem

### Situation

Marketers share links across dozens of channels every day.

### Complication

Existing shorteners treat analytics and bookmarks as separate concerns.

### Question

How can we give publishers one workspace for every link they share?

## Personas

### Publisher

A marketer or developer who shares links professionally.

- Goals: Share clean short links; Know which channel drives clicks
- Frustrations: Manual UTM tagging is tedious
- Context: Desktop browser, shares on Twitter/X and LinkedIn
- Weight: primary

### Consumer

**Role:** Anyone who clicks a shortened link.
**Goals:**
- Arrive at the destination quickly and safely
**Frustrations:**
- Shortened links obscure the destination
**Context:** Clicks from social media and email, no account.
**Weight:** Secondary

## Jobs to be done

### Share a clean link quickly

**Persona:** Publisher
**Statement:** When I have a URL to share, I want a short memorable link in seconds.
**Type:** functional
**Importance:** critical
**Satisfaction:** underserved
**Related to:** Know which channel drives the most clicks
**Desired outcomes:**
- Minimize the time to get a short link — importance: high, current satisfaction: medium
- Maximize the memorability of the slug (importance medium, satisfaction low)

## Goals

### Drive weekly active publishers

Grow the number of publishers who shorten at least one link a week.

- Horizon: short term
- Owner: Head of Product
- Metrics:
  - Indicator: Weekly active publishers
    - Target: 500 within 6 months
    - Baseline: 0
    - Measurement: Product analytics, weekly cohort

## Features

### FEAT-001 Link shortening

Publisher pastes a long URL and gets a short, shareable link.

- For: Publisher
- Value: Core utility — the action that brings publishers to the product
- MoSCoW: Must
- Status: accepted
- Addresses: Share a clean link quickly
- Advances: Drive weekly active publishers

This paragraph is a note to the team and belongs to no clause.

#### US-001 As a publisher, I want to paste a URL and get a short link in one click

**Acceptance criteria:**
- AC-001-01 Short link is generated within 1 second
- AC-001-02 Short link is copied to the clipboard automatically
- [ ] Publisher can customize the slug before confirming

### feature Auto-channel analytics

- Summary: Every click is attributed to a channel without UTM tags
- Persona: Publisher
- Value proposition: Per-channel data with zero effort
- Priority: should
- Status: proposed
- Stories:
  - US-010 As a publisher, I want to see clicks per channel
    - AC-010-01 The dashboard shows one row per channel
    - Clicks from unknown referrers are grouped as direct

## Open questions

### Custom domain pricing

**Question:** Should custom domains be a paid add-on?
**Context:** Competitors gate them behind a team plan.
**Owner:** Product lead
**Deadline:** 2026-03-01
**Status:** open

## User journeys

### Publisher shortens and shares a link

**For:** Publisher
**Trigger:** Publisher has a blog post URL to share
**Outcome:** The link is shared and clicks are tracked per channel
**Steps:**
- step 1
  - Action: Publisher pastes the long URL
  - System response: A short link appears with the page title
  - Channel: web
  - Emotional tone: confident
- Publisher pastes the link into a tweet
  - Channel: external
  - Order: 2
`;

describe('a loosely written PRD in Markdown', () => {
    it('is read into the product, with warnings for what was assumed and reported', async () => {
        const r = await read({ text: loose, fileName: 'sniplink.prd.md' });
        const codes = r.diagnostics.map(d => d.code);
        expect(r.diagnostics.filter(d => d.severity === 'error').map(d => d.message)).toEqual([]);
        expect(r.ok).toBe(true);
        // the stray paragraph is reported on its line, not dropped
        const unmapped = r.diagnostics.filter(d => d.code === 'MD-UNMAPPED');
        expect(unmapped.map(d => d.message)).toEqual([expect.stringContaining('note to the team')]);
        expect(unmapped[0].line).toBe(loose.split('\n').findIndex(l => l.startsWith('This paragraph')) + 1);
        // the paragraph under the product became its vision, with a word about it
        expect(codes).toContain('MD-VISION');
        // bare names under group headings took the group's kind
        expect(codes).toContain('MD-DEFAULT-KIND');

        const doc = r.model as PrdDocument;
        const p = doc.products[0];
        expect(p.name).toBe('Sniplink');
        expect(p.vision).toMatch(/^A URL shortener/);
        expect(p.scope).toEqual(['Shorten a URL: paste, get a short link', 'Per-channel click analytics']);
        expect(p.nonGoals).toEqual(['A mobile app for v1']);
        expect(p.problem).toEqual({
            situation: 'Marketers share links across dozens of channels every day.',
            complication: 'Existing shorteners treat analytics and bookmarks as separate concerns.',
            question: 'How can we give publishers one workspace for every link they share?',
        });
        expect(p.personas?.map(x => x.name)).toEqual(['Publisher', 'Consumer']);
        expect(p.personas?.[0]).toEqual({
            name: 'Publisher',
            role: 'A marketer or developer who shares links professionally.',
            goals: ['Share clean short links', 'Know which channel drives clicks'],
            frustrations: ['Manual UTM tagging is tedious'],
            context: 'Desktop browser, shares on Twitter/X and LinkedIn',
            weight: 'primary',
        });
        expect(p.personas?.[1].weight).toBe('secondary');
        expect(p.jobs?.[0].desiredOutcomes).toEqual([
            { statement: 'Minimize the time to get a short link', importance: 'high', currentSatisfaction: 'medium' },
            { statement: 'Maximize the memorability of the slug', importance: 'medium', currentSatisfaction: 'low' },
        ]);
        expect(p.goals?.[0]).toEqual({
            name: 'Drive weekly active publishers',
            statement: 'Grow the number of publishers who shorten at least one link a week.',
            horizon: 'short-term',
            owner: 'Head of Product',
            metrics: [{ indicator: 'Weekly active publishers', target: '500 within 6 months', baseline: '0', measurement: 'Product analytics, weekly cohort' }],
        });
        const [f1, f2] = p.features ?? [];
        expect(f1).toMatchObject({
            id: 'FEAT-001',
            name: 'Link shortening',
            summary: 'Publisher pastes a long URL and gets a short, shareable link.',
            persona: 'Publisher',
            valueProposition: 'Core utility — the action that brings publishers to the product',
            priority: 'must',
            status: 'accepted',
            addresses: ['Share a clean link quickly'],
            advances: ['Drive weekly active publishers'],
        });
        expect(f1.stories).toEqual([
            {
                id: 'US-001',
                title: 'As a publisher, I want to paste a URL and get a short link in one click',
                acceptanceCriteria: [
                    { id: 'AC-001-01', text: 'Short link is generated within 1 second' },
                    { id: 'AC-001-02', text: 'Short link is copied to the clipboard automatically' },
                    { text: 'Publisher can customize the slug before confirming' },
                ],
            },
        ]);
        expect(f2.name).toBe('Auto-channel analytics');
        expect(f2.stories).toEqual([
            {
                id: 'US-010',
                title: 'As a publisher, I want to see clicks per channel',
                acceptanceCriteria: [{ id: 'AC-010-01', text: 'The dashboard shows one row per channel' }, { text: 'Clicks from unknown referrers are grouped as direct' }],
            },
        ]);
        expect(p.openQuestions?.[0]).toMatchObject({ name: 'Custom domain pricing', deadline: '2026-03-01', status: 'open' });
        expect(p.journeys?.[0]).toEqual({
            name: 'Publisher shortens and shares a link',
            persona: 'Publisher',
            trigger: 'Publisher has a blog post URL to share',
            outcome: 'The link is shared and clicks are tracked per channel',
            steps: [
                { number: 1, action: 'Publisher pastes the long URL', systemResponse: 'A short link appears with the page title', channel: 'web', emotionalTone: 'confident' },
                { name: 'Publisher pastes the link into a tweet', channel: 'external', order: 2 },
            ],
        });

        // and what the reader produced is a document the writer round-trips
        const md = write(codecFor('prd'), doc, 'markdown');
        const again = await read({ text: md, fileName: 'sniplink.prd.md' });
        expect(again.diagnostics).toEqual([]);
        expect(JSON.parse(JSON.stringify(again.model))).toEqual(JSON.parse(JSON.stringify(doc)));
    });

    it('names the missing clause of an element as an error, and still returns a model', async () => {
        const text = `# product Demo

## persona Visitor

**Role:** Someone passing by.
**Goals:**
- Look around
**Frustrations:**
- Slow pages
**Context:** Mobile, in a hurry.

## feature Search

**Summary:** Find a link by keyword.
**Persona:** Visitor
**Priority:** must
**Status:** proposed
`;
        const r = await read({ text, fileName: 'demo.prd.md' });
        const errors = r.diagnostics.filter(d => d.severity === 'error');
        expect(errors.map(d => `${d.code}: ${d.message}`)).toEqual([
            'MD-MISSING: persona "Visitor" needs a **Weight:** line; assuming secondary',
            'MD-MISSING: feature "Search" needs a **Value proposition:** line',
        ]);
        expect(errors[0].line).toBe(3);
        expect(r.ok).toBe(false);
        const p = (r.model as PrdDocument).products[0];
        expect(p.personas?.[0].weight).toBe('secondary');
        expect(p.features?.[0].valueProposition).toBe('');
    });

    it('reads a file without a product heading as one product, with an error', async () => {
        const r = await read({ text: '## persona Visitor\n\n**Role:** Someone.\n**Goals:**\n- Look\n**Frustrations:**\n- Wait\n**Context:** Here.\n**Weight:** primary\n', fileName: 'x.prd.md' });
        expect(r.diagnostics.map(d => d.code)).toContain('MD-PRODUCT');
        expect((r.model as PrdDocument).products[0].personas?.[0].name).toBe('Visitor');
    });
});
