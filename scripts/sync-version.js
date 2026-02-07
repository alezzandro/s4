#!/usr/bin/env node
/**
 * Syncs the appVersion in Chart.yaml with the version from root package.json.
 *
 * Usage: node scripts/sync-version.js
 *
 * This script is intended to be run after bumping the version in package.json:
 *   npm version patch --no-git-tag-version
 *   npm run version:sync
 */

const fs = require('fs');
const path = require('path');

const rootPkg = require('../package.json');
const chartPath = path.join(__dirname, '../charts/s4/Chart.yaml');

const content = fs.readFileSync(chartPath, 'utf8');
const updated = content.replace(/^appVersion:.*$/m, `appVersion: "${rootPkg.version}"`);
fs.writeFileSync(chartPath, updated);

console.log(`Synced Chart.yaml appVersion to ${rootPkg.version}`);
