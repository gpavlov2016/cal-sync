
# create-react-app with PostgreSQL intergration

- fork or download the repo
- npm install
- Create a `.env` file similar to the `.env.example.env` or modify the current example and include your PostgreSQL username, password, database and port.
- Change your collumn names in Api.js to the corresponding ones in your database
  `e.g. {item.FooBar}`
- Change your query in App.js to the corresponding one in your database
  `e.g. client.query("SELECT * FROM FooBar", function(err, result) {})`
- node api.js
  * API local endpoint: http://localhost:8080/api.json
- npm start
  * App starts on: http://localhost:3000/

