# Build Instructions

## Prerequisites
1.  **Install Java Development Kit (JDK) 11+**:
    - Download from [Adoptium](https://adoptium.net/) or Oracle.
    - Ensure `JAVA_HOME` environment variable is set.
2.  **Install Android SDK**:
    - Bubblewrap will attempt to download this automatically if not found.

## Build Steps
1.  Open a terminal in this folder: `cd f:\AapKaBakaya\AKB-android`
2.  Run the build command:
    ```powershell
    npx @bubblewrap/cli build
    ```
3.  Follow the prompts to generate a keystore (if asked) or use the defaults in `twa-manifest.json`.

## Output
- The signed Android App Bundle (`.aab`) will be generated in this folder.
- Upload `app-release-bundle.aab` to Google Play Console.
