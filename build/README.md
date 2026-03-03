# App icon

To use a custom app icon for the built executable:

1. **Add `icon.png`** (512×512 or 1024×1024 pixels) in this folder.  
   - A sample design is provided as `icon.svg`. Open it in any image editor (Figma, Inkscape, etc.) and export as PNG, or use an online SVG→PNG converter.

2. **electron-builder is already configured** to use `build/icon.png` (see `package.json` → `"build.icon"`).

3. **Build**: Run `npm run build`. The icon is used for the installer and the app window.

Without this, the build uses the default Electron icon.
