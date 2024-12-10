const data = require("./database");

function route(app) {
  app.use("/api", data);
}

module.exports = route;
