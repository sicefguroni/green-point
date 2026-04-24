const ee = require("@google/earthengine");
const privateKey = require("./gee-key.json");

ee.data.authenticateViaPrivateKey(
  privateKey,
  () => {
    console.log("Auth success! Initializing...");
    ee.initialize(
      null,
      null,
      () => {
        console.log("Init success!");
      },
      (err) => {
        console.error("Init Error Raw:", err);
      },
      null,
      privateKey.project_id,
    );
  },
  (err) => {
    console.error("Auth Error Raw:", err);
  },
);
