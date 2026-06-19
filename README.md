# CRM Backend System

A modular Node.js and Express RESTful API backend integrated with MySQL for managing users, customers, leads, and interaction timelines.

## Architecture Structure
* `config/` - Database connection configuration pooling
* `middleware/` - Custom authentication validation and security routing filters
* `routes/` - Contextual request endpoint controller handlers
* `server.js` - Microservice bootstrap initialization root entry-point

## Getting Started
1. Install project application dependencies:
   ```bash
   npm install