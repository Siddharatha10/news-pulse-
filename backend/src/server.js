require("dotenv").config();

const express = require("express");
const cors = require("cors");

const clustersRouter = require("./routes/clusters");
const ingestRouter = require("./routes/ingest");

const app = express();
const PORT = process.env.PORT || 4000;

// A raw "*" needs to be passed to the cors package as the string "*",
// not as a one-element array - cors treats an array as an explicit
// whitelist, so ["*"] would only ever match an Origin header that is
// literally the string "*" and every real browser request gets blocked.
const rawOrigin = process.env.CORS_ORIGIN || "*";
const CORS_ORIGIN = rawOrigin === "*" ? "*" : rawOrigin.split(",");

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(clustersRouter);
app.use(ingestRouter);

// 404 for anything that didn't match a route above
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Centralized error handler - anything an async route throws (or
// passes to next(err)) lands here instead of crashing the process.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`News Pulse API listening on port ${PORT}`);
});
