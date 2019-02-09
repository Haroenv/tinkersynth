/**
 * This file is a utility we can call after someone makes a purchase.
 *
 * It will take the set of parameters used on the client-side to build their
 * piece of art, and will generate an SVG similar to SlopesExports.
 *
 * It will also save it to disk, and produce a super-big PNG which can be
 * emailed to the user.
 *
 * Both the SVG and PNG will be saved to disk, so that the transactional
 * email sent to the user can link to them (seems easier than finding an ESP
 * that supports huge file attachments?). I might also want to add a cron job
 * that deletes the JPEG after a time. But whatever.
 */
import fs from 'fs';
import path from 'path';

import { Storage } from '@google-cloud/storage';
import svg2img from 'svg2img';
import uuid from 'uuid/v1';
import { polylinesToSVG } from '../vendor/polylines';

import { PRINT_SIZES } from '../constants';
import {
  clipLinesWithMargin,
  groupPolylines,
  retraceLines,
} from '../helpers/line.helpers';
import generator from '../components/Slopes/Slopes.generator';
import transformParameters from '../components/Slopes/Slopes.params';

// We use Google Cloud Platform storage to save all image assets.
const gcpProjectId = 'tinkersynth';
const gcpBucketName = 'tinkersynth-art';
const storage = new Storage({
  projectId: gcpProjectId,
});

const writeFile = (...args) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(...args, err => {
      if (err) {
        return reject(err);
      }

      resolve();
    });
  });
};

const process = async (size, params) => {
  const { width: printWidth, height: printHeight } = PRINT_SIZES[size];

  // Our aspect ratio depends on the size selected.
  // By default, our size is 18 x 24.
  const aspectRatio = printWidth / printHeight;

  const height = 552;
  const width = height * aspectRatio;
  const drawingVariables = transformParameters({
    height,
    ...params,
  });

  let lines = generator({
    width,
    height,
    ...drawingVariables,
  });

  // Create a smaller SVG by joining lines
  lines = groupPolylines(lines);

  // Trim any lines that fall outside the SVG size
  lines = clipLinesWithMargin({ lines, width, height, margins: [0, 0] });

  const filename = uuid();

  const svgMarkup = polylinesToSVG(lines, { width, height });

  const fileOutputPath = path.join(__dirname, '../../output');

  const svgPath = path.join(fileOutputPath, `${filename}.svg`);
  const pngPath = path.join(fileOutputPath, `${filename}.png`);

  await writeFile(svgPath, svgMarkup);

  // Create a raster PNG as well
  // We want our raster image to be printable at 300dpi.
  const rasterWidth = printWidth * 300;
  const rasterHeight = printHeight * 300;
  svg2img(
    svgMarkup,
    { width: rasterWidth, height: rasterHeight },
    async (error, buffer) => {
      await writeFile(pngPath, buffer);
    }
  );
};

export default process;
