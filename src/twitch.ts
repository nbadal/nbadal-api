import crypto from "crypto";
import express from "express";
import oauth2 from "simple-oauth2";
import TwitchClient from "twitch";
import firebase from "./firebase";

const router = express.Router();

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
        const accessToken = result.access_token;
        const refreshToken = result.refresh_token;
        const twitchClient = TwitchClient.withCredentials(clientId, result.access_token);

        twitchClient.users.getMe().then((user) => {
            const twitchId = user.id;
            const twitchName = user.name;
            const userId = `twitch:${twitchId}`;

            firebase.firestore().collection("users").doc(userId).set({
                twitchAuth: {
                    accessToken,
                    refreshToken,
                },
                twitchName,
            });

            firebase.auth().createCustomToken(userId).then((userToken) => {
                const clientUrl = process.env.CLIENT_URL || "http://localhost:4200";
                res.redirect(`${clientUrl}/auth/${userToken}`);
            });
        });
    }, (error) => {
        console.log(error.message);
        res.sendStatus(500);
    });
});

export = router;
