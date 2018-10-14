import crypto from "crypto";
import express from "express";
import admin from "firebase-admin";
import * as request from "request";

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

router.get("/redirect", (req, res) => {
    const state = req.cookies.state || crypto.randomBytes(20).toString("hex");
    const host = req.get("host");
    const secureCookie = typeof host === "string" && (host.indexOf("localhost") !== 0);
    res.cookie("state", state.toString(), {maxAge: 3600000, secure: secureCookie, httpOnly: true});
    res.redirect(`https://id.twitch.tv/oauth2/authorize`
        + `?client_id=${clientId}`
        + `&redirect_uri=${req.protocol}://${host}/twitch/callback`
        + `&response_type=code`
        + `&scope=user_read`
        + `&state=${state}`);
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

    request.post(`https://id.twitch.tv/oauth2/token`
        + `?client_id=${clientId}`
        + `&client_secret=${clientSecret}`
        + `&code=${req.query.code}`
        + `&grant_type=authorization_code`
        + `&redirect_uri=${req.protocol}://${req.get("host")}/twitch/callback`,
        (tokenError, tokenResponse, tokenBody) => {
            if (tokenError) {
                res.status(500).send(JSON.stringify(tokenError));
                return;
            }
            if (tokenResponse.statusCode !== 200) {
                res.status(200).send(tokenBody);
                return;
            }

            const tokenJson = JSON.parse(tokenBody);

            const accessToken = tokenJson.access_token;
            const refreshToken = tokenJson.refresh_token;

            request.get({
                headers: {
                    "Accept": "application/vnd.twitchtv.v5+json",
                    "Authorization": `OAuth ${accessToken}`,
                    "Client-ID": clientId,
                },
                uri: "https://api.twitch.tv/kraken/user",
            }, ((infoError, infoResponse, infoBody) => {
                if (infoError) {
                    res.status(500).send(JSON.stringify(infoError));
                    return;
                }

                if (infoBody.error) {
                    res.status(200).send(infoBody.error);
                    return;
                }
                const infoJson = JSON.parse(infoBody);

                const twitchId = infoJson._id;
                firebase.auth().createCustomToken(`twitch:${twitchId}`)
                    .then((token) => {
                        res.status(200).send(`${twitchId}'s token is: ${token}`);
                    }, (err) => {
                        res.status(500).send(JSON.stringify(err));
                    });
            }));
        });
});

export = router;
