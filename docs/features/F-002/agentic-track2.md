---
doc: agentic-track2
owner: "@qa"
status: runbook (T-002-Q7)
---

# F-002 · Track 2 — agentic QA runbook

> Track 2 is **scheduled** (nightly + before release) and **does not block merge**
> (WEB_TEAM §3.7). Its output is a report and a loopback to `@ux`/`@product`,
> never a red build. Track 1 is what gates merges.

## Personas

| id | who | what they have never done |
|---|---|---|
| **P1** | เจ้าของร้าน SME ไทย, ไม่สาย tech | never used an ERP; reads the screen, not the manual |
| **P2** | พนักงานรายวัน (Staff) | never chose anything about the shop; opens what the owner sent them |

Score each flow **1–5** on: *did the person reach the goal without help*, and
*did they understand what happened*. Those are two different scores; a flow can
be completed and misunderstood, and that combination is the one worth reporting.

## The seven flows (§15), in the order they are worth running

The first two are named by the board as the highest-value pair — run them first
even in a short session.

| # | flow | the question | why it is worth the run |
|---|---|---|---|
| **2** | ออกลิงก์ใหม่ | does the person understand the previous link is dead? | the one AC where we deliberately break the user's expectation (D-027). **A code read closed the biggest part of this before any browsing — see below.** |
| **7** | admin-reset ให้เจ้าของร้าน → 404 | how stuck is the Owner? | the price D-030/C-2 accepted, and nobody has seen it on a screen |
| 1 | สร้างร้านแรก + เชิญพนักงาน 1 คน | do they realise they must send the link themselves? | D-012 is the MVP's main flow and it contradicts every SaaS habit |
| 3 | เชิญซ้ำคนเดิม → `INVITATION_PENDING` | do they find the way out? | D-027 forbids a dead end; the panel now has to prove it |
| 4 | ถูกถอดกลางคัน | do they think the app broke? | §12.1 E-07's human half |
| 5 | Staff เจอ 403 ในเมนูที่มองเห็น | are they confused? | ties to ux Q13 (hide, not disable) |
| 6 | กรอก TIN ผิด | does the error take them to the fix? | 13 digits copied off paper |

## What to record per flow

1. the two scores (reached the goal / understood what happened);
2. the exact sentence the person read when they hesitated — the copy, verbatim;
3. what they expected to happen instead;
4. one suggested change, or "none".

Copy findings go to `@ux` (owner of the words) and `@product` (owner of whether
the flow is right). Neither is a defect against `@frontend` unless the screen
disagrees with the wireframe — in which case it is a Track 1 gap and belongs in
`tasks.md`, not here.

## What this runbook cannot do, today

There is no browser lane (§12.1 has no Playwright, and `e2e-web` has no service
containers), so an agentic session needs a **locally running stack**: Postgres +
Redis + API + web. Until a deploy target or a compose-based dev stack exists,
Track 2 is a manual-with-an-agent exercise, not a scheduled job.

---

## Finding from the first pass (2026-08-14) — flow 2, before any browsing

Flow 2 asks whether the reader understands that the old link dies. Reading the
screen against ux-wireframe §9.2/§9.3 answered it without a browser:

> **"ออกลิงก์ใหม่" and "ยกเลิกคำเชิญ" both fired on the first press.** No
> confirmation, no warning, no toast afterwards. The link the inviter had
> already sent over LINE stopped working, and nothing on screen said so — before
> or after.

The wireframe requires a confirmation for both (§9.2/§9.3), and the Contract
summary's item 4 says "ยืนยันก่อนเสมอ". This was not a copy problem an agentic
run could have improved: with no dialog, flow 2 scores 1 on "understood what
happened" for every persona, every time.

Fixed in the same pass with ux's verbatim copy, plus tests
(`MembersScreen.confirm.test.tsx`): the first press asks, the dialog states the
consequence and names the invitee, the dismiss button for the cancel dialog is
"ไม่ยกเลิก" (so the two buttons cannot be misread as the same word), and the
safe button holds focus.

**What is still worth running flow 2 for:** whether the sentence
"ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที" is understood as *"the message I already
sent is now useless"* — the words are correct; whether they land is a question
only a reader can answer.
