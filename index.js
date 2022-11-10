require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { CloudantV1, IamAuthenticator } = require("@ibm-cloud/cloudant");
const app = express();

let dbName = "session-guests";
let port = process.env.PORT || 8080;
let cloudant_apikey, cloudant_url;

if (process.env.CE_SERVICES) {
  ce_services = JSON.parse(process.env.CE_SERVICES);
  cloudant_apikey = ce_services["cloudantnosqldb"][0].credentials.apikey;
  cloudant_url = ce_services["cloudantnosqldb"][0].credentials.url;
}

if (process.env.CLOUDANT_URL) {
  cloudant_url = process.env.CLOUDANT_URL;
}

if (process.env.CLOUDANT_APIKEY) {
  cloudant_apikey = process.env.CLOUDANT_APIKEY;
}

if (!cloudant_apikey || !cloudant_url) {
  console.log("Missing Cloudant environment variables");
  process.exit(0);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authenticator = new IamAuthenticator({ apikey: cloudant_apikey });

const cloudantService = new CloudantV1({
  authenticator: authenticator,
  serviceUrl: cloudant_url,
});

const createDb = (dbName) => {
  return new Promise((resolve, reject) => {
    cloudantService
      .putDatabase({ db: dbName })
      .then(({ result }) => {
        if (result?.ok) console.log(`Database '${dbName}' created!!!`);
        resolve();
      })
      .catch(({ status, body }) => {
        body = JSON.parse(body);
        if (status == 412) {
          console.log(body?.reason);
          resolve();
        } else {
          console.log(body);
          reject();
        }
      });
  });
};

const addToDb = (db, document) => {
  return new Promise((resolve, reject) => {
    cloudantService
      .postDocument({ db, document })
      .then(({ result }) => resolve(result))
      .catch((error) => reject(error));
  });
};

const getFromDb = (db, query = {}) => {
  return new Promise((resolve, reject) => {
    cloudantService
      .postFind({ db, selector: query })
      .then(({ result }) => resolve(result?.docs))
      .catch(reject);
  });
};

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.post("/guest/create", async (req, res) => {
  try {
    const data = req?.body;
    const result = await addToDb(dbName, data);

    res.status(201).send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.get("/guest/all", async (req, res) => {
  try {
    const result = await getFromDb(dbName);

    res.status(200).send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

createDb(dbName)
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.log("Error to create database");
    process.exit(0);
  });
