# **n8n-nodes-leadspicker**

This is an n8n community node. It lets you use the Leadspicker API in your n8n workflows.

Leadspicker is a B2B data and sales intelligence platform that helps businesses find, enrich, and connect with relevant contacts.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)

[Operations](#operations)

[Credentials](#credentials)

[Compatibility](#compatibility)

[Resources](#resources)

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
* **Reply**  
  * Get replies based on filters (email accounts, campaigns, sentiment)  
* **Linkedin Activity**  
  * Get a LinkedIn profile's details  
  * Get a profile's latest posts  
  * Get a profile's recent activities (reactions and comments)  
  * Get people who reacted to posts and send the results to a webhook
  * Retrieve LinkedIn profiles that reacted to posts returned by a content search URL
  * Retrieve reactors for posts authored by specific LinkedIn profiles

Note: The Linkedin Activity operations "Search Post Reactors" and "Profiles Post Reactors" auto-paginate. They aggregate all pages internally (handling the cursor automatically) and return a single flat list of reactor profiles.

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
