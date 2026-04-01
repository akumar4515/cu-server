const dotenv = require("dotenv");

dotenv.config();

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  publicServerUrl: process.env.PUBLIC_SERVER_URL || ""
};

module.exports = config;
