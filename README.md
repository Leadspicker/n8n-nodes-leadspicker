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

* **Person**  
  * Create a new person in a project  
  * Delete a person  
  * Get a person by ID  
  * List persons in a project  
  * Update an existing person  
* **Project**  
  * Create a new project  
  * Delete a project  
* **Reply**  
  * Get replies based on filters (email accounts, projects, sentiment)  
* **AutoCPH** (Automated Contact Person Hunting)  
  * Find contacts by a company's LinkedIn URL  
  * Find contacts by a company's name  
* **Linkedin Activity**  
  * Get a LinkedIn profile's details  
  * Get a profile's latest posts  
  * Get a profile's recent activities (reactions and comments)  
  * Get people who reacted to posts and send the results to a webhook
  * Retrieve LinkedIn profiles that reacted to posts returned by a content search URL

Note: The Linkedin Activity operation "Search Post Reactors" auto-paginates through the content search results. It aggregates all pages internally (handling the cursor automatically) and returns a single flat list of reactor profiles.

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
