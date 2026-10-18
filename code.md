I called the same internal Wix Dev Center API that the Wix CLI uses. There's no CLI command or dashboard button for adding a code identifier to an existing app, so I sent the request myself with `curl`, signed in as you.

1. **Where I found the endpoint.** It's defined in the CLI installed in your project, in `node_modules/@wix/cli/build/chunk-3RDLWUOW.js`. The method is `wix.devcenter.apps.v1.AppsService.SetCodeIdentifier`: `PATCH /v1/apps/{appId}/set-code-identifier`, sent to `https://manage.wix.com` (the CLI's base URL, from `chunk-QWUVSSZT.js`) under the `/apps-service` path prefix.

2. **Authentication.** I used `npx wix token`, which prints the access token for your logged-in CLI session. So the request was made as you, the same way the CLI makes its own requests.

3. **A read first, to confirm the route.**
   ```bash
   curl "https://manage.wix.com/apps-service/v1/apps/386a20a7-69ff-46a2-bc5b-2c2ce9eb7a78" \
     -H "Authorization: $(npx wix token)"
   ```
   It returned your app with `codeIdentifier: null`.

4. **The write you approved.**
   ```bash
   curl -X PATCH "https://manage.wix.com/apps-service/v1/apps/386a20a7-69ff-46a2-bc5b-2c2ce9eb7a78/set-code-identifier" \
     -H "Authorization: $(npx wix token)" -H "Content-Type: application/json" \
     -d '{"appId":"386a20a7-69ff-46a2-bc5b-2c2ce9eb7a78","codeIdentifier":"HiKonsultsSmartAuctionManager"}'
   ```
   The response was `{"codeIdentifier":"HiKonsultsSmartAuctionManager"}` with HTTP 200.

5. **A second read to check it stuck.** It showed the code identifier, plus `appEntityChanges: true`, which means it's waiting for a release.

This endpoint is **undocumented**. Wix's public docs only mention choosing a code identifier when you create an app. It's the same call Wix's own app-creation tool makes. If Wix support ever asks how it was set, that's the answer.