const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");

//FIREBASE ADMIN INIT 
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  }),
});

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//MONGODB 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pca4tsp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//  Middleware: Verify Firebase JWT 
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};

//  MAIN FUNCTION 
async function run() {
  try {
    await client.connect();

    const serviceCollection = client.db("serviceDb").collection("services");
    const bookingsCollection = client.db("bookingDb").collection("bookings");
    const messagesCollection = client.db("messageDb").collection("messages");

    console.log("MongoDB Connected & Routes Ready");

    // ----------------- SERVICES -----------------
    app.post("/services", verifyFirebaseToken, async (req, res) => {
      try {
        const newService = {
          ...req.body,
          providerEmail: req.user.email,
          providerName: req.user.name || req.user.email,
          createdAt: new Date(),
        };

        const result = await serviceCollection.insertOne(newService);
        res.status(201).send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to add service" });
      }
    });

    app.get("/services", async (req, res) => {
      const services = await serviceCollection.find().toArray();
      res.send(services);
    });

    app.get("/services/:id", async (req, res) => {
      const service = await serviceCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(service);
    });

    app.put("/services/:id", verifyFirebaseToken, async (req, res) => {
      const result = await serviceCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete("/services/:id", verifyFirebaseToken, async (req, res) => {
      const result = await serviceCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ----------------- BOOKINGS -----------------
    app.post("/bookings", verifyFirebaseToken, async (req, res) => {
      try {
        const booking = {
          ...req.body,
          customerEmail: req.user.email,
          customerName: req.user.name || req.user.email,
          createdAt: new Date(),
          serviceStatus: "pending",
        };

        const result = await bookingsCollection.insertOne(booking);
        res.status(201).send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to save booking" });
      }
    });

    app.get("/bookings", verifyFirebaseToken, async (req, res) => {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    });

    app.patch("/bookings/:id", verifyFirebaseToken, async (req, res) => {
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { serviceStatus: req.body.serviceStatus } }
      );
      res.send(result);
    });

    // ----------------- MESSAGES -----------------
    app.post("/messages", async (req, res) => {
  try {
    const message = { ...req.body, createdAt: new Date() };
    const result = await messagesCollection.insertOne(message);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to save message" });
  }
});


    app.get("/messages", verifyFirebaseToken, async (req, res) => {
      const messages = await messagesCollection.find().toArray();
      res.send(messages);
    });

    app.listen(port, () =>
      console.log(`Server running on port ${port}`)
    );
  } catch (err) {
    console.error("MongoDB Connection Failed:", err);
  }
}

run().catch(console.dir);
