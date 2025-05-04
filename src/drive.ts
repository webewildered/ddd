const CLIENT_ID = '1061908190627-rvg57uk4euv27b8hovka4i1ph56o5onu.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBZC2CEvNyjdJYH4-31LNAYFpD2F7Plny0';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const FILENAME = 'ddd.txt';

export class GDriveAppData
{
    private tokenClient: google.accounts.oauth2.TokenClient;
    private accessToken: string | null = null;
    private tokenCallback: ((tokenResponse: google.accounts.oauth2.TokenResponse) => void) | null = null;

    constructor()
    {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: tokenResponse => this.onTokenResponse(tokenResponse)
        });
    }

    onTokenResponse(tokenResponse: google.accounts.oauth2.TokenResponse): void
    {
        if (this.tokenCallback !== null)
        {
            this.tokenCallback(tokenResponse);
            this.tokenCallback = null;
        }
    }

    init(): Promise<void>
    {
        return new Promise((resolve, reject) =>
        {
            gapi.load('client', () =>
            {
                gapi.client.init(
                    {
                        apiKey: API_KEY,
                        discoveryDocs: [DISCOVERY_DOC]
                    })
                    .then(() => resolve())
                    .catch((error: Error) => reject(error));
            });
        });
    }

    signIn(): Promise<void>
    {
        if (this.tokenCallback !== null)
        {
            return Promise.reject(new Error('Login already in progress'));
        }
        return new Promise((resolve, reject) =>
        {
            this.tokenCallback = tokenResponse =>
            {
                if (tokenResponse.error)
                {
                    reject(new Error(`Error signing in: ${tokenResponse.error}\n${tokenResponse.error_description}`));
                }
                else
                {
                    console.log('valid for: ' + tokenResponse.expires_in);
                    this.accessToken = tokenResponse.access_token;
                    resolve();
                }
            };
            this.tokenClient.requestAccessToken({prompt: 'none'});
        });
    }

    isSignedIn(): boolean
    {
        return this.accessToken !== null;
    }

    save(content: string): Promise<any>
    {
        // First, check if file exists
        return gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
            q: `name='${FILENAME}'`
        })
            .then(listRes =>
            {
                const files = listRes.result.files || [];
                const fileMetadata = {
                    name: FILENAME,
                    parents: ['appDataFolder'],
                    mimeType: 'text/plain',
                };
                const media = {
                    mimeType: 'text/plain',
                    body: content,
                };

                if (files.length === 0)
                {
                    console.log('creating new');
                    // Create new
                    return gapi.client.drive.files.create(
                        {
                            resource: fileMetadata,
                            fields: 'id, name'
                        }).then(createRes => createRes.result.id);
                }

                return files[0].id; // Return the ID of the existing file
            })
            .then(fileId =>
            {
                // Update existing
                if (fileId === undefined)
                {
                    throw new Error('File ID is undefined');
                }

                console.log('updating ' + fileId);
                return gapi.client.request(
                {
                    path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    body: content,
                    params: {
                        uploadType: 'media',
                        fields: 'id,version,name',
                    },
                });
            });
    }

    load(): Promise<string>
    {
        // Find the file
        return gapi.client.drive.files.list(
            {
                spaces: 'appDataFolder',
                fields: 'files(id, name)',
                q: `name='${FILENAME}'`
            })
            .then(listRes =>
            {
                const files = listRes.result.files || [];
                if (files.length === 0)
                {
                    console.log('doesnt exist');
                    return '';
                }
                const fileId = files[0].id;
                if (fileId === undefined)
                {
                    console.log('id undefined');
                    return '';
                }

                // Download the file
                return gapi.client.drive.files.get(
                {
                    fileId,
                    alt: 'media'
                })
                .then(resp =>
                {
                    return resp.body as string
                });
            });
    }
}
