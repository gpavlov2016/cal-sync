# Google Calendar Postgres Sync Node.js server

This repo contains the backend server implementing oAuth2 access to google calendar APIs,
syncing the events to a Postgress DB and providing the events from a REST API. 

### Get started
- Fork or [Download](https://github.com/gpavlov2016/cal-sync.git) the repo
 
### Install dependencies
- `$npm install`
 
### Login to the database
- Create a `.env` file similar to the `.env.example.env` or modify the current file
- Include your PostgreSQL username, password, database and port.

### Start the server
- `$npm start` 
    
API local endpoint: http://localhost:8080/events

## Live demo
[https://main.d1x2kmcxa2g52u.amplifyapp.com/](https://main.d1x2kmcxa2g52u.amplifyapp.com/)