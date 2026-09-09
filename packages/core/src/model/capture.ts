/**
 * Capturing a site model to disk.
 *
 * A captured model is how the tests avoid needing a Docusaurus install, how a
 * user files a reproducible bug, and how a site whose Docusaurus version this
 * tool cannot load can still be rendered.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigError, VERSION } from '../util';
import type { SiteModel } from './types';
import type { SourceReader } from './reader';

/** A model as it is stored, with enough provenance to read it later. */
export interface CapturedModel {
  /** Format version of this file. */
  capture: 1;
  /** Version of pterodocs that wrote it. */
  pterodocs: string;
  /** When it was written. */
  capturedAt: string;
  /** The model itself. */
  model: SiteModel;
}

/** Serialise a model. */
export function serializeModel(model: SiteModel): string {
  const captured: CapturedModel = {
    capture: 1,
    pterodocs: VERSION,
    capturedAt: new Date().toISOString(),
    model,
  };
  return `${JSON.stringify(captured, null, 2)}\n`;
}

/** Write a model to a file, creating its directory. */
export async function writeCapture(file: string, model: SiteModel): Promise<void> {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, serializeModel(model), 'utf8');
}

/**
 * Read a captured model.
 *
 * @param file Path of the capture.
 */
export async function readCapture(file: string): Promise<SiteModel> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new ConfigError(`Could not read the model at ${file}.`);
  }

  let parsed: Partial<CapturedModel>;
  try {
    parsed = JSON.parse(raw) as Partial<CapturedModel>;
  } catch {
    throw new ConfigError(`${file} is not valid JSON.`);
  }

  if (parsed.capture !== 1 || !parsed.model) {
    throw new ConfigError(
      `${file} is not a pterodocs model capture. Produce one with \`pterodocs capture\`.`,
    );
  }
  return parsed.model;
}

/**
 * Read from a model captured earlier.
 *
 * @param file Path to the capture.
 */
export function createCaptureReader(file: string): SourceReader {
  let cached: SiteModel | undefined;
  const load = async (): Promise<SiteModel> => {
    cached ??= await readCapture(file);
    return cached;
  };
  return {
    kind: 'captured',
    async locales(): Promise<string[]> {
      return [(await load()).locale];
    },
    async read(): Promise<SiteModel> {
      return load();
    },
  };
}
