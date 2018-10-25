export interface OverlayResponse {
    title: string;
    lists: TrelloList[];
}

export interface TrelloList {
    id: string;
    name: string;
    cards: TrelloCard[];
}

export interface TrelloCard {
    id: string;
    name: string;
}

export interface OverlayData {
    board: string;
    lists: string[];
    title: string;
    user: string;
}

export interface UserData {
    trelloAuth: UserTrelloAuth;
    twitchAuth: UserTwitchAuth;
    twitchName: string;
}

export interface UserTrelloAuth {
    secret: string;
    token: string;
}

export interface UserTwitchAuth {
    accessToken: string;
    refreshToken: string;
}
