# Artemis Lounge

A free home bar companion that runs in any phone browser.

- **Make**: see which cocktails you can mix right now, and which are one bottle away.
- **My Bar**: scan bottles with a Bluetooth barcode scanner or the phone camera, or add them by name. Set each bottle to Full, Half, Low or Out.
- **Menu**: pick tonight's drinks. Guests open the menu on their own phones by link or QR code, or you print it.
- **Shop**: low bottles and the single purchases that unlock the most new drinks.

Each person's bar is stored only in their own browser. Nothing is uploaded. Use **More > Save backup file** to keep a copy or move to a new phone.

## Hosting

This is a static site with no build step. It is served by GitHub Pages from the `main` branch.

## Files

| File | What it holds |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app |
| `menu.html` | The guest menu page (the menu travels inside the link) |
| `data.js` | Built-in recipes and the ingredient list |
| `barcodes.js` | Products already identified by barcode |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline use and "Add to Home Screen" |
