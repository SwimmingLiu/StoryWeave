#!/usr/bin/env node
// Runtime copies are generated from src; edit the canonical source and repackage.
import { main } from '../runtime/workflow/cli.mjs';
try { process.exitCode = await main(process.argv.slice(2)) ?? 0; }
catch (error) { console.error(error.message); process.exitCode = 1; }
