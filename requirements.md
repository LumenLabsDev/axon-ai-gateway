# Axon AI Product Requirements — Compiled

## Table of Contents
- [Axon AI Getting Started Requirements](#axon-getting-started-requirements)
- [Axon AI Guardrails Requirements](#axon-guardrails-requirements)
- [Axon AI Api Keys Requirements](#axon-api-keys-requirements)
- [Axon AI Workspace Control Requirements](#axon-workspace-control-requirements)
- [Axon AI Prompts Requirements](#axon-prompts-requirements)
- [Axon AI Prompt Partials Requirements](#axon-prompt-partials-requirements)
- [Axon AI Playground Requirements](#axon-playground-requirements)


---

<a id="axon-getting-started-requirements"></a>

# Axon AI — Getting Started Page Requirements

> **Goal:** Provide a fast, self-serve onboarding path to take a workspace from 0 → first successful API call in minutes. The page guides users to set up their environment, connect a provider, and run a test request with copyable starter code.

## 1) Information Architecture
- **Route:** Left nav → *Getting Started*
- **Layout Blocks (top → bottom):**
  1. **Welcome Hero** (personalized)
  2. **Setup your environment** (API Key + Provider Integration)
  3. **Integrate Axon AI** (language code snippets + test run)
  4. **Help & Resources**

## 2) Welcome Hero
- Title: “Hi {first_name}, welcome to Axon AI!”
- Subtitle: “Take your GenAI apps to production confidently in a few steps”
- Quick links: **Developer Docs**, **Join our Discord**, **View GitHub**, **Talk to us**
- **Product Demo** CTA (top-right) opens modal or navigates to demo page.

## 3) Setup Your Environment
### 3.1 API Key Card
- Shows the **workspace API key** (masked with copy + reveal).
- Caption: “Use this to authenticate all your requests to Axon AI.”
- Actions: **Copy**, **Reveal/Hide** (auto-hide after 30s).

### 3.2 Provider Integration Card
- “We encrypt your original API keys and generate disposable keys.”
- **Select new AI provider to integrate** dropdown → provider setup wizard.

## 4) Integrate Axon AI (Starter Code)
- Language switcher: Node.js (default), Python, cURL, Go.
- Model selector (disabled until a provider is configured).
- Buttons: **Run Test Request**, **Copy to Integrate**.
- Inline console shows streamed output + timing/tokens.

## 5) Progress & Persistence
- Checklist stored (API key copied, provider connected, test request success).

## 6) Help & Resources
- “Need Help?” near code; “Skip this step” anchor.

## 7) RBAC & Telemetry
- Visible to all; provider creation may require Admin.
- Events: `onboarding_viewed`, `api_key_copied`, `provider_wizard_completed`, `starter_code_run_success/failure`, `starter_code_copied`, `product_demo_opened`.

## 8) Non-Functional & Edge Cases
- Render ≤ 800 ms; no secrets in logs/telemetry.
- If no provider, disable model selector with CTA.



---

<a id="axon-guardrails-requirements"></a>

# Axon AI — Guardrails Page Requirements

## 1) Purpose
Define, manage, and enforce **content checks** and **actions** before/after LLM inference. Provide a listing of guardrails and a builder (Checks & Actions).

## 2) Listing
- Columns: **Name**, **ID**, **Created By**, **Created**, **Last Update**.
- Search & sort; click row → open builder in edit mode.

## 3) Builder — Checks Tab
- **Selected Guardrail Checks** (left column) vs **All checks** library (right).
- Built-in checks: Regex, Word/Sentence/Character Count, JSON Schema/Keys, Contains/Ends With, Valid URLs/Code, Uppercase, No Gibberish, Moderation (partner), No PHI, SydeGuard, Scan Prompt/Response, Webhook, Validate Project.
- Each check card supports: enable/disable, parameters, timeout, inverse, delete.
- Ordering defines execution order.
- Save/Update button with validation (e.g., JSON correctness).

## 4) Builder — Actions Tab
- **On Success** and **On Failure** sections:
  - Add feedback score (value -10..10, weight 0..1, metadata JSON).
  - Option: **Deny the request if guardrail fails**.
- Settings: **Run this guardrail asynchronously**.

## 5) Execution & Enforcement
- Modes: **block** or **observe** (workspace binding).
- Async execution returns verdict later with correlation ID.

## 6) RBAC, Audit, Telemetry
- Viewer (read), Editor (create/update), Admin (delete/bind).
- Audit all changes; telemetry for executions, failures, denials.

## 7) Performance
- Check execution budget default 5–15s with per-check timeout.



---

<a id="axon-api-keys-requirements"></a>

# Axon AI — API Keys Page Requirements

## Purpose
Create and manage **service** and **user** API tokens with fine-grained permissions.

## Listing
- Columns: **Name**, **Key** (masked), **Created By**, **Created**, **Last Update**, **Type**.
- Search by name/partial key; open side drawer for details.

## Create / Edit (Drawer)
- Tabs: **API Key Details**, **Permissions**.
- Details: Type (Service/User), Name (unique), Description, Config, Metadata (JSON).
- Permissions matrix (Read/Write/List etc.) for Workspaces, Keys, Users, Providers, Integrations, Completions, Prompts, Configs, Guardrails, Virtual Keys, Analytics (view), Logs (view/list/export/write).
- Presets: Read-Only, Writer, Custom. Select All toggle.

## Lifecycle & Security
- Show secret once at creation; rotate/suspend/delete with audit trail.
- Optional IP allowlist and expiry; rate limits by type.

## Non-Functional
- Create round-trip ≤ 500 ms; full keyboard/ARIA support.



---

<a id="axon-workspace-control-requirements"></a>

# Axon AI — Workspace Control Page Requirements

## Purpose
Manage workspace identity (icon, name), description, and metadata; link workspace-level guardrails.

## General Tab
- Workspace ID (copy), Icon picker, Name (unique), Description, Metadata (JSON editor).
- Save with optimistic UI; unsaved-changes guard; JSON validation.

## Workspace Guardrails
- Bind default guardrails; show enforcement mode; “Used by N configs”.

## Governance & Audit
- Viewer (read), Editor (update general), Admin (guardrail binding).
- Audit events for updates.



---

<a id="axon-prompts-requirements"></a>

# Axon AI — Prompts Page Requirements

## Goal
Central place to browse and manage prompt templates. Authoring happens in **Playground**.

## Listing
- Search, **Create** (Prompt/Folder), columns: **Name**, **Owner**, **Last Modified**, **Status**, **Version**.
- Empty state with CTA.
- Click opens read-only **Prompt Detail** drawer: summary, versions, **Open in Playground**.

## Versioning & Status
- Versions v1..vN; statuses Draft → Development → Staging → Production (one active prod).

## RBAC & Telemetry
- Viewer (view), Editor (create/edit non-prod), Publisher/Admin (publish prod).
- Events: `prompt_list_viewed`, `prompt_opened`, `prompt_open_in_playground`, `prompt_published`.



---

<a id="axon-prompt-partials-requirements"></a>

# Axon AI — Prompt Partials Builder Requirements

## Goal
Reusable **prompt fragments** to compose prompts in Playground.

## Editor
- **Name** (unique) and **Template** editor (supports `{{var}}`).
- Save with version bump; keyboard save; navigation guard.
- Errors: empty fields, invalid name, >64KB template.

## RBAC/Audit
- Viewer read-only, Editor create/update, Admin delete; audit logs.



---

<a id="axon-playground-requirements"></a>

# Axon AI — Playground Requirements

## Goal
Author, test, compare, and save prompts.

## Layout
- Left: **Prompt Template** (System/User/Tool blocks), provider/model selector, params, Pretty/JSON, media attachment, partials insert.
- Right: **Completion** output, Recent runs.

## Variables Panel
- Slide-over, detected variables with inputs, Pretty/JSON toggle.

## Generate & Inspect
- Run with streaming; show tokens/time and raw JSON. Errors surfaced clearly.

## Compare
- Baseline vs up to 2 variants; side-by-side outputs; quick vote/notes.

## Save & Versioning
- Save Prompt modal (name, desc, folder, status Draft/Development).
- Version History drawer with publish/restore.

## RBAC & Non-Functional
- Viewer can run; Editor save; Publisher/Admin publish.
- Keystroke latency <50 ms; first render ≤700 ms.

