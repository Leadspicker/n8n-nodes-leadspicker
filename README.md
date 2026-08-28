# **n8n-nodes-leadspicker**

This is an n8n community node. It lets you use the Leadspicker API in your n8n workflows.

Leadspicker is a B2B data and sales intelligence platform that helps businesses find, enrich, and connect with relevant contacts.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)

[Operations](#operations)

[Triggers](#triggers)

[Credentials](#credentials)

[Compatibility](#compatibility)

[Resources](#resources)

[Changelog](#changelog)

## **Installation**

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## **Operations**

This node supports the following resources and operations:

* **Lead**
  * Create a new lead in a list
  * Delete a lead
  * Get a lead by ID
  * List leads in a list
  * Update an existing lead
  * Find leads by a company's LinkedIn URL
  * Find leads by a company's name
* **List or Sequence**
  * Get many lists (with optional name search; returns all or up to a limit)
  * Get many sequences (with optional name search; returns all or up to a limit)
  * Create a new list
  * Delete a list
  * Delete a sequence
  * Get the sequence log (timeline events with optional search, date, person, and type filters)
  * Add a lead to the sequence exclusion list
  * Remove a lead from the sequence exclusion list
  * Get the sequence exclusion list
* **Reply**
  * Get replies based on filters (email accounts, lists or sequences, sentiment)
* **Linkedin Activity**
  * Get a LinkedIn profile's details
  * Get a profile's latest posts
  * Get a profile's recent activities (reactions and comments)
  * Get people who reacted to posts and send the results to a webhook
  * Retrieve LinkedIn profiles that reacted to posts returned by a content search URL
  * Retrieve reactors for posts authored by specific LinkedIn profiles
* **Global Exclusion List**
  * Add a lead identifier to the global exclusion list
  * Remove a lead identifier from the global exclusion list
  * Get the global exclusion list
* **Outreach**
  * List LinkedIn outreach accounts
  * List email outreach accounts
* **Account**
  * Get account info and limits

Note: The Linkedin Activity operations "Search Post Reactors" and "Profiles Post Reactors" auto-paginate. They aggregate all pages internally (handling the cursor automatically) and return a single flat list of reactor profiles.

## **Triggers**

The Leadspicker Trigger node lets you subscribe to webhook events across all projects or filter down to a single list or sequence and fire workflows from these Leadspicker events:

* Account revoked (connected account access revoked)
* Email bounced
* Email reply
* Email sent
* LinkedIn reply
* LinkedIn sent
* Lead added to a project

## **Credentials**

To use this node, you need to authenticate using your Leadspicker API credentials.

1. Sign up for an account with [Leadspicker](https://leadspicker.com/).
2. Find your API Key in your account settings on the Leadspicker platform.
3. In n8n, create a new credential for the Leadspicker node.
4. Enter your API Key into the credential configuration screen.

## **Compatibility**

This node has been developed and tested against n8n version 1.0.0. It may work with older versions, but it is not guaranteed.

## **Resources**

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Leadspicker Website](https://leadspicker.com/)

## **Changelog**

### 0.6.1

* Node and credential icons now use the official brand mark. The hand-approximated 88x99 path is replaced by the 226x251 one from the brand page, the light-theme icon is brand black `#060606`, and the dark-theme icon is white; it previously used `#7B9BFF`, which is not a brand color.
* Restored `nodes/Leadspicker/logo_leadspicker.svg`. The n8n creator portal requests that exact path for the package listing's icon, and the 0.6.0 rename to `-light`/`-dark` variants left it returning 404.

### 0.6.0

* Added **Get Many Lists** and **Get Many Sequences** operations under the List or Sequence resource, returning projects as workflow data with an optional name search, a `Return All` toggle, and a `Simplify` toggle that switches between the id/name projection and the full payload with stats and settings.
* The credential's **Domain** field now drives every API request, not just the credential test, so a workflow can run against a local or staging backend. A missing scheme is added and a pasted `/app/sb/api` suffix is dropped; leaving it empty keeps the production host.
* Fixed the n8n review violations from 0.5.1: the trigger node gained a `subtitle`, raw errors are wrapped in `NodeApiError`/`NodeOperationError` so failures surface consistently in the UI, the Leadspicker node declares `usableAsTool` for AI agent workflows, and both nodes and the credential ship light and dark icon variants.

### 0.5.1

* Added npm provenance to the publishing workflow.

### 0.5.0

* Moved every project call onto the `/lists` and `/sequences` prefixes, following the backend's split of the deprecated `/projects` namespace. Renamed the Campaign resource to **List or Sequence**, and split the delete operation into **Delete List** and **Delete Sequence** so each addresses its own kind. Stored resource, operation and parameter values are unchanged, so workflows saved against earlier versions keep working.

### 0.4.4

* Removed Leadspicker runtime logging.

### 0.4.3

* Replaced global timer usage with n8n workflow sleep helper to satisfy community-node linting.

### 0.4.2

* Compliance fixes for n8n verification (removed external dependency usage and updated auth helper).

### 0.4.1
* Added an **Account** resource with a "Get Account Info" action that surfaces subscription renewal dates, allowed LinkedIn/email accounts, allowed robots, and how many robots are currently running.
* Added an **Outreach** resource to list all connected LinkedIn accounts and configured email accounts in one call so workflows can fan out automatically.
* Added campaign-level exclusion list management actions (add, remove, list).
* Added a **Global Exclusion List** resource to manage the organization-wide blacklist and return categorized LinkedIn/email/domain identifiers.
* Leadspicker Trigger can now listen to every project when no campaign is selected.
* Leadspicker Trigger requests Leadspicker to immediately send a test payload whenever the node is executed manually so `Test workflow` runs receive sample data instantly.
* Added a **Bulk Create Leads** action under the Lead resource to send multiple user-provided leads (with optional custom fields) to the `/persons/bulk` API endpoint in a single call.

### 0.4.0

* **Breaking:** Replaced the legacy `leadspickerNode` with the new `Leadspicker` node (type `leadspicker`), renamed resources to Lead/Campaign/Reply/Linkedin, and moved the AutoCPH operations under the Lead resource. Existing workflows referencing `leadspickerNode` must be recreated.
* **Breaking:** Lead operations now expose individual fields (name, email, company, socials, custom fields) and all ID selectors use "Name or ID" dropdowns with a manual ID fallback, so any references to the previous collection-style parameters need to be reconfigured.
* **Breaking:** Lead responses are flattened (no nested `person_data`) and the Lead/Reply list operations auto-paginate to return the entire dataset rather than a single page, changing the output structure and removing pagination parameters.
* Added the Leadspicker Trigger node that manages webhooks for account revoked, email sent/replied/bounced, LinkedIn sent/replied, and lead-added events per campaign.
* Linkedin Activity operations gained new controls (include/exclude profile cards, opt-in liker/commenter collection) and cursor-based aggregation so reactor searches return a single deduplicated array.
* Lead finders now return the same flattened lead payloads as create/get/update results, keeping company/contact metadata consistent when searching by company name or LinkedIn URL.

### 0.3.1

* Legacy release of the original `leadspickerNode` implementation.
