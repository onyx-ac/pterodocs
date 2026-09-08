#!/usr/bin/env node
// Shipped unbuilt so the entry point stays readable and stable.
import { main } from '../lib/cli/run.js';

process.exitCode = await main(process.argv.slice(2));
