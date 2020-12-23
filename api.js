var dotenv = require("dotenv").config(),
  express = require("express"),
  pg = require("pg"),
  cors = require("cors"),
  app = express();

const util = require('util');
const url = require('url');
const { google } = require('googleapis');
const { oauth2 } = require("googleapis/build/src/apis/oauth2");

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'email'];

//Allowed cors in localhost
app.use(cors());

//Database Config .env
const config = {
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASS,
  port: process.env.PG_PORT,
  host: process.env.PG_HOST
};

const baseUrl = 'http://localhost:8080';
const redirect_uri =  baseUrl + '/oauth2callback';
const client_secret = 'jSMiSaVU4Dv4b9rxOBmRpyEW';
const client_id = '809758834696-bnm6pb62roqcv967j2s68t9qrbloindl.apps.googleusercontent.com';

//Documentation for node-postgres: https://node-postgres.com/
const pool = new pg.Pool(config);
var pgClient = undefined;
console.log(config);
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

// async/await - check out a client
;(async () => {
  pgClient = await pool.connect()
})().catch(err => console.log(err.stack))

app.get("/oauth2callback", (req, res) => {
  const queryObject = url.parse(req.url, true).query;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  console.log(queryObject.code);
  oAuth2Client.getToken(queryObject.code, (err, token) => {
    if (err) {
      console.error('Error retrieving access token ' + err);
      return res.status(400).send();
    }
    console.log('token: ', token);
    oAuth2Client.setCredentials(token);
    var oauth2 = google.oauth2({
      auth: oAuth2Client,
      version: 'v2'
    });
    oauth2.userinfo.v2.me.get(
      async function(err, me) {
          if (err) {
              console.log(err);
          } else {
              await addUser(me.data.email, token)
              res.redirect(`http://localhost:3000?email=${me.data.email}`);
          }
      });
  });
});


app.get("/events", async (req, res) => {
  const queryObject = url.parse(req.url, true).query;
  console.log(queryObject.email);
  const user = await getUser(queryObject.email);
  if (!user || !user.length == 0 ) {
    return res.status(403).send('user error');
  }
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  // console.log(user.credentials);
  oAuth2Client.setCredentials(user.credentials);
  if (!user.credentials) {
    return res.status(403).send('credentials error');
  }
  oAuth2Client.email = user.email;
  // console.log('user ', user);
  const syncRes = await syncEvents(oAuth2Client, user.sync_token);
  if (!syncRes) {
    return res.status(500).send();
  }
  const events = await getEvents(queryObject.email);
  res.send(events);
});

app.get("/authUrl", async (req, res) => {
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.send({authUrl});
});


async function getEvents(email) {
  const res = await pgClient.query({
    text: "SELECT * FROM events\
           WHERE email = $1",
    values: [ email, 
            ]
  }).catch((err) => {
    console.log(err);
    return undefined;
  });

  return res.rows;
}

async function getUser(email) {
  const res = await pgClient.query({
    text: "SELECT * FROM users\
           WHERE email = $1",
    values: [ email, 
            ]
  }).catch((err) => {
    console.log(err);
    return undefined;
  });

  // console.log(res);
  return res.rows[0];
}

async function addUser(email, credentials) {
  await pgClient.query({
    text: "INSERT INTO users(email, credentials)\
           VALUES ($1, $2)\
           ON CONFLICT (email) DO UPDATE SET credentials=EXCLUDED.credentials",
    values: [ email, 
              credentials
            ]
  }).catch((err) => {
    console.log(err);
    return undefined;
  });
}

async function syncEvents(auth, syncToken) {
  const calendar = google.calendar({version: 'v3', auth});
  const options = {
    calendarId: 'primary',
  };
  let pageToken = undefined;
  do {
    console.log('syncToken ', syncToken);
    if (pageToken) {
      options.pageToken = pageToken;
    } else if (syncToken) {
      options.syncToken = syncToken;
    } else {
      options.timeMin = (new Date(2019, 01, 01)).toISOString();
      // maxResults: 10,
      // singleEvents: true,
      // orderBy: 'startTime',
    }
    console.log(options);
    calendar.events.listPromise = util.promisify(calendar.events.list);
    const res = await calendar.events.listPromise(options).catch((e) => {
      console.log('listPromise error ', e)
      return false;
    });
    if (res.status == 410) { //invalid token
      syncToken = undefined;
      continue; //retry full sync
    }
    const events = res.data.items;
    // console.log('events ', events);
    console.log('events.length ', events.length);
    if (events.length) {
      console.log('Syncing events:');
      events.forEach((event) => upsertEvent(event, auth.email));
    }
    pageToken = res.data.nextPageToken;
    console.log('pageToken ', pageToken);
    if (res.data.nextSyncToken) {
      console.log('res.data.nextSyncToken ', res.data.nextSyncToken);
      updateNextSyncToken(auth.email, res.data.nextSyncToken)
    } 
  } while (pageToken)

  return true;
}


async function upsertEvent(event, email) {
  const res = await pgClient.query({
    text: "INSERT INTO events(google_id, email, event_obj)\
           VALUES ($1, $2, $3)\
           ON CONFLICT (google_id) DO UPDATE SET event_obj=EXCLUDED.event_obj",
    values: [ event.id, 
              email,
              event
            ]
  }).catch((err) => {
    console.log(err);
    return undefined;
  });
}

async function updateNextSyncToken(email, nextSyncToken) {
  const res = await pgClient.query({
    text: "INSERT INTO users(email, sync_token)\
           VALUES ($1, $2)\
           ON CONFLICT (email) DO UPDATE SET sync_token=EXCLUDED.sync_token",
    values: [ email, 
              nextSyncToken
            ]
  }).catch((err) => {
    console.log('updateNextSyncToken ', err);
    return undefined;
  });
}


//Server
app.listen(8080, function () {
  console.log("API listening on http://localhost:8080");
});
