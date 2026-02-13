import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // The redirect URI must match what's configured in Google Cloud Console
    // For BFF flow, this is usually the client callback, but since we are exchanging invalid codes from client,
    // we might need 'postmessage' or the actual callback URL.
    // When using 'useGoogleLogin' with 'auth-code' flow from @react-oauth/google,
    // the redirect_uri should be 'postmessage'.
    'postmessage'
);

export const GoogleAuth = {
    client: oauth2Client,

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string) {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    },

    /**
     * Refresh access token using refresh_token
     */
    async refreshAccessToken(refreshToken: string) {
        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        return credentials;
    },

    /**
     * Verify Id Token to get user profile
     */
    async verifyIdToken(idToken: string) {
        const ticket = await oauth2Client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return payload;
    },

    /**
     * Get User Info using Access Token
     */
    async getUserInfo(accessToken: string) {
        oauth2Client.setCredentials({ access_token: accessToken });
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data;
    }
};
