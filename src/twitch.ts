import crypto from "crypto";
import express from "express";
import admin from "firebase-admin";
import oauth2 from "simple-oauth2";
import TwitchClient from "twitch";

const router = express.Router();
const privateKey = process.env.FIREBASE_PRIVATE_KEY || " ";
const firebase = admin.initializeApp({
    credential: admin.credential.cert({
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        projectId: process.env.FIREBASE_PROJECT_ID,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const clientId = process.env.TWITCH_CLIENT_ID || "";
const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";

const twitchAuth = oauth2.create({
    auth: {
        authorizePath: "/oauth2/authorize",
        tokenHost: "https://id.twitch.tv",
        tokenPath: "/oauth2/token",
    },
    client: {
        id: clientId,
        secret: clientSecret,
    },
    options: {
        authorizationMethod: "body",
    },
});

router.get("/redirect", (req, res) => {
    const state = req.cookies.state || crypto.randomBytes(20).toString("hex");
    const host = req.get("host");
    const secureCookie = typeof host === "string" && (host.indexOf("localhost") !== 0);
    res.cookie("state", state.toString(), {maxAge: 3600000, secure: secureCookie, httpOnly: true});

    const authorizeUri = twitchAuth.authorizationCode.authorizeURL({
        redirect_uri: `${req.protocol}://${host}/twitch/callback`,
        scope: "user_read",
        state,
    });
    res.redirect(authorizeUri);
});

router.get("/callback", (req, res) => {
    if (!req.cookies.state) {
        res.status(400)
            .send("State cookie not set or expired. Maybe you took too long to authorize. Please try again.");
        return;
    } else if (req.cookies.state !== req.query.state) {
        res.status(400).send("State validation failed");
        return;
    }

    twitchAuth.authorizationCode.getToken({
        code: req.query.code,
        redirect_uri: `${req.protocol}://${req.get("host")}/twitch/callback`,
    }).then((result) => {
        const twitchClient = TwitchClient.withCredentials(clientId, result.access_token);

        twitchClient.users.getMe().then((user) => {
            const twitchId = user.id;
            const userId = `twitch:${twitchId}`;
            firebase.auth().createCustomToken(userId).then((token) => {
                res.status(200).send(`${twitchId}'s token is: ${token}`);
            });
        });
    }, (error) => {
        res.status(500).send(JSON.stringify(error));
    });
});

export = router;
