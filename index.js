const express = require("express");
const mongodb = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URL || "mongodb://127.0.0.1:27017";
const saltRounds = 10;


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});


const mailData = {
  from: process.env.EMAIL,
  subject: "Reset your password",
};


let mailMessage = (url) => {
  return `<p>Hi there,<br> You have been requested to reset your password.<br>please click on the link below to reset the password.<br><a href='${url}' target='_blank'>${url}</a><br>Thank you...</p>`;
};

app.post("/login", async (req, res) => {
  try {
    let client = await mongoClient.connect(dbUrl);
    let db = client.db("LOG-PASS");
    let user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      let compare = await bcrypt.compare(req.body.password, user.password);
      if (compare) {
        res.status(200).json({ message: "user logged in successfully" });
      } else {
        res.status(401).json({ message: "incorrect password" });
      }
    } else {
      res.status(400).json({ message: "user not found" });
    }
    client.close();
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});


app.post("/register-user", async (req, res) => {
  try {
    let client = await mongoClient.connect(dbUrl);
    let db = client.db("LOG-PASS");
    let user = await db.collection("users").findOne({ email: req.body.email });
    if (!user) {
      let salt = await bcrypt.genSalt(saltRounds);
      let hash = await bcrypt.hash(req.body.password, salt);
      req.body.password = hash;
      let result = await db.collection("users").insertOne(req.body);
      res.status(200).json({ message: "user registered successfully, Login now to continue" });
    } else {
      res.status(400).json({ message: "user already exists, please login" });
    }
    client.close();
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});





app.post("/forgot-password", async (req, res) => {
  try {
    let client = await mongoClient.connect(dbUrl);
    let db = client.db("LOG-PASS");
    let random_string = Math.random().toString(36).substring(5).toUpperCase();
    let user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      let salt = await bcrypt.genSalt(saltRounds);
      let hash = await bcrypt.hash(random_string, salt);
      req.body.random_string = hash;
      await db
        .collection("users")
        .findOneAndUpdate(
          { email: req.body.email },
          { $set: { random_string: req.body.random_string } }
        );
      let ResetUrl = `${req.body.targetUrl}?id=${user._id}&rps=${req.body.random_string}`;
      mailData.to = req.body.email;
      mailData.html = mailMessage(ResetUrl);
      await transporter.sendMail(mailData);
      res.status(200).json({ message: "Password reset link sent to email" });
    } else {
      res.status(403).json({ message: "user is not registered" });
    }
    client.close();
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});


app.post("/verify-random-string", async (req, res) => {
  try {
    let client = await mongoClient.connect(dbUrl);
    let db = client.db("LOG-PASS");
    let user = await db.collection("users").findOne({ _id: objectId(req.body._id) });
    let unicodeString = req.body.verificationString
    req.body.verificationString = decodeURIComponent(JSON.parse('"' + unicodeString.replace(/\"/g, '\\"') + '"'));
    console.log(user)
    if (user) {
      if (user.random_string == req.body.verificationString) {
        res.status(200).json({ message: "verification string valid" });
      } else {
        res.status(403).json({ message: "verification string not valid" });
      }
    } else {
      res.status(403).json({ message: "user doesn't exist" });
    }
    client.close();
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});


app.post("/assign-password", async (req, res) => {
  try {
    let client = await mongoClient.connect(dbUrl);
    let db = client.db("LOG-PASS");
    let user = await db
      .collection("users")
      .findOne({ _id: objectId(req.body._id) });
      console.log(user)
    let unicodeString = req.body.verificationString
    req.body.verificationString = decodeURIComponent(JSON.parse('"' + unicodeString.replace(/\"/g, '\\"') + '"'));
    if (user.random_string == req.body.verificationString) {
      let salt = await bcrypt.genSalt(saltRounds);
      let hash = await bcrypt.hash(req.body.password, salt);
      req.body.password = hash;
      await db
        .collection("users")
        .findOneAndUpdate(
          { _id: objectId(req.body._id) },
          { $set: { random_string: "" } }
        );
      await db
        .collection("users")
        .findOneAndUpdate(
          { _id: objectId(req.body._id) },
          { $set: { password: req.body.password } }
        );
      res.status(200).json({ message: "password changed successfully" });
    } else {
      res.status(403).json({ message: "user with the id not found" });
    }
    client.close();
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => console.log(port));