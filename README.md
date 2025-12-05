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
  * Create a new lead in a campaign
  * Delete a lead
  * Get a lead by ID
  * List leads in a campaign
  * Update an existing lead
  * Find leads by a company's LinkedIn URL
  * Find leads by a company's name
* **Campaign**
  * Create a new campaign
  * Delete a campaign
  * Get the campaign log (timeline events with optional search, date, person, and type filters)
  * Add a lead to the campaign exclusion list
  * Remove a lead from the campaign exclusion list
  * Get the campaign exclusion list
* **Reply**
  * Get replies based on filters (email accounts, campaigns, sentiment)
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

The Leadspicker Trigger node lets you subscribe to webhook events across all projects or filter down to a single campaign and fire workflows from these Leadspicker events:

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

### 0.4.1

* Added an **Account** resource with a "Get Account Info" action that surfaces subscription renewal dates, allowed LinkedIn/email accounts, allowed robots, and how many robots are currently running.
* Added an **Outreach** resource to list all connected LinkedIn accounts and configured email accounts in one call so workflows can fan out automatically.
* Added campaign-level exclusion list management actions (add, remove, list).
* Added a **Global Exclusion List** resource to manage the organization-wide blacklist and return categorized LinkedIn/email/domain identifiers.
* Leadspicker Trigger can now listen to every project when no campaign is selected.
* Leadspicker Trigger requests Leadspicker to immediately send a test payload whenever the node is executed manually so `Test workflow` runs receive sample data instantly.

### 0.4.0

* **Breaking:** Replaced the legacy `leadspickerNode` with the new `Leadspicker` node (type `leadspicker`), renamed resources to Lead/Campaign/Reply/Linkedin, and moved the AutoCPH operations under the Lead resource. Existing workflows referencing `leadspickerNode` must be recreated.
* **Breaking:** Lead operations now expose individual fields (name, email, company, socials, custom fields) and all ID selectors use "Name or ID" dropdowns with a manual ID fallback, so any references to the previous collection-style parameters need to be reconfigured.
* **Breaking:** Lead responses are flattened (no nested `person_data`) and the Lead/Reply list operations auto-paginate to return the entire dataset rather than a single page, changing the output structure and removing pagination parameters.
* Added the Leadspicker Trigger node that manages webhooks for account revoked, email sent/replied/bounced, LinkedIn sent/replied, and lead-added events per campaign.
* Linkedin Activity operations gained new controls (include/exclude profile cards, opt-in liker/commenter collection) and cursor-based aggregation so reactor searches return a single deduplicated array.
* Lead finders now return the same flattened lead payloads as create/get/update results, keeping company/contact metadata consistent when searching by company name or LinkedIn URL.

### 0.3.1

* Legacy release of the original `leadspickerNode` implementation.
