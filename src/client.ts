import * as fs from 'fs';
import { PNG } from 'pngjs';
import colorConverter from './colorConverter';
import logger from './logger';
import { PixelWorker } from './pixelWorker';
import userInput, { IProgramParameters } from './userInput';
import versionChecker from './versionChecker';

// tslint:disable-next-line: variable-name
import imageDither from 'image-dither';
import { URL } from 'url';
import axios from 'axios';
import { ReadStream } from 'tty';

async function startAndGetUserInput() {
    // Every once in a while check for updates. So it will startup with update installed next time;
    setInterval(async () => {
        await versionChecker.start();
    }, 1000 * 60 * 20); /* Every 20 mins */

    await versionChecker.start();
    // update logging will be the first thing that shows up after start.

    await userInput.gatherProgramParameters();

    if (!userInput.currentParameters) {
        throw new Error("Parameters couldn't be parsed");
    }

    logger.log(
        `-------------------------------------------\nStarting with parameters: ${JSON.stringify(
            userInput.currentParameters,
        )}`,
    );

    return start(userInput.currentParameters);
}

async function start(params: IProgramParameters) {
    let pictureStream: ReadStream | fs.ReadStream | undefined;
    if (isValidURL(params.imgPath)) {
        logger.log('Input is URL, downloading...');
        const pictureResponse = await axios
            .get<ReadStream>(params.imgPath, {
                responseType: 'stream',
            })
            .catch(() => {});
        if (!pictureResponse) {
            // error.
            logger.logError('Can not download picture from provided url!');
            return;
        }

        pictureStream = pictureResponse.data;
        logger.log('Done downloading.');
    } else {
        logger.log('Reading the picture...');
        pictureStream = fs.createReadStream(params.imgPath);
    }

    pictureStream
        .pipe(new PNG())
        .on('parsed', async function(this: PNG) {
            logger.log(`Done reading. ${this.width} x ${this.height}`);
            await startProgram(params, this);
        })
        .on('error', (error) => {
            logger.logError(
                `Could not load the picture, make sure image is valid PNG file.\n${
                    error.message
                }`,
            );
        });
}

async function startProgram(params: IProgramParameters, png: PNG) {
    if (params.ditherTheImage) {
        // Dither the image (makes photos look better, more realistic with color depth)
        /* matrices available to use.
    Dither.matrices.atkinson
    Dither.matrices.burkes
    Dither.matrices.floydSteinberg
    Dither.matrices.jarvisJudiceNinke
    Dither.matrices.oneDimensional
    Dither.matrices.sierraLite
    Dither.matrices.sierra2
    Dither.matrices.sierra3
    Dither.matrices.stucki
    Dither.matrices.none
    */
        const options = {
            findColor: (channelArray: [number, number, number, number]) => {
                const convertedColor = colorConverter.convertActualColor(
                    channelArray[0],
                    channelArray[1],
                    channelArray[2],
                );

                const resultArr = colorConverter.getActualColor(convertedColor);
                resultArr.push(channelArray[3]);
                return resultArr;
            },
            matrix: imageDither.matrices.floydSteinberg,
        };
        const dither = new imageDither(options);
        const ditheredImg = dither.dither(png.data, png.width, undefined);
        const ditheredDataBuffer = Buffer.from(ditheredImg);
        png.data = ditheredDataBuffer;
        png.pack()
            .pipe(fs.createWriteStream('expectedOutput.png'))
            .on('close', () => {
                logger.log(
                    'expectedOutput.png <- Contains the final expected image.',
                );
            });
    } else {
        // Convert all colors to 24 provided by the website beforehand
        // and output a picture for a preview.
        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                // tslint:disable-next-line: no-bitwise
                const idx = (png.width * y + x) << 2;

                const r = png.data[idx + 0];
                const g = png.data[idx + 1];
                const b = png.data[idx + 2];
                const convertedColor = colorConverter.convertActualColor(
                    r,
                    g,
                    b,
                );
                const resultArr = colorConverter.getActualColor(convertedColor);
                png.data[idx + 0] = resultArr[0];
                png.data[idx + 1] = resultArr[1];
                png.data[idx + 2] = resultArr[2];
            }
        }
        png.pack()
            .pipe(fs.createWriteStream('expectedOutput.png'))
            .on('close', () => {
                logger.log(
                    'expectedOutput.png <- Contains the final expected image.',
                );
            });
    }

    const worker = await PixelWorker.create(
        png,
        { x: params.xLeftMost, y: params.yTopMost },
        params.doNotOverrideColors,
        params.customEdgesMapImagePath,
        params.fingerprint,
    );

    logger.log("Ok, let's go!");

    await worker.waitForComplete();
    // await for the full process. Here full image should be finished.

    logger.log('Finished painting!');

    if (!params.constantWatch) {
        // Job is done. Exit the process...
        logger.log('all done!');
        process.exit(0);
        return;
    }
    // Do not exit process, will continue to listen to socket changes
    // and replace non matching pixels.
    logger.log('Continuing to watch over...');
}

function isValidURL(url: string): boolean {
    try {
        if (!url.startsWith('http')) {
            return false;
        }
        const temp = new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

startAndGetUserInput().catch();
