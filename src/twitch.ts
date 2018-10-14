import crypto from "crypto";
import express from "express";
import * as request from "request";

const router = express.Router();

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
        + `&scope=`
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
        (error, response, body) => {
            if (error) {
                res.status(500).send(JSON.stringify(error));
                return;
            }

            const accessToken = body.access_token;
            const refreshToken = body.refresh_token;

            // TODO: store tokens and create user if necessary.

            res.sendStatus(200);
        });
});

export = router;
