import * as fs from "fs";
import { PNG } from "pngjs";
import readline from "readline";
import { ChunkCache } from "./chunkCache";
import colorConverter from "./colorConverter";
import { Guid } from "./guid";
import { ImageProcessor } from "./imageProcessor";
import { PixelWorker } from "./pixelWorker";
import userInput, { IProgramParameters } from "./userInput";

// tslint:disable-next-line: no-var-requires
const Dither = require("image-dither");

async function startAndGetUserInput() {
    await userInput.gatherProgramParameters();

    if (!userInput.currentParameters) {
        throw new Error("Parameters couldn't be parsed");
    }

    // tslint:disable-next-line: no-console
    console.log("-------------------------------------------\nStarting with parameters: " + JSON.stringify(userInput.currentParameters));
    return start(userInput.currentParameters);
}

async function start(params: IProgramParameters) {
    fs.createReadStream(params.imgPath)
    .pipe(new PNG())
    .on("parsed", async function(this: PNG) {
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
                    const convertedColor = colorConverter.convertActualColor(channelArray[0], channelArray[1], channelArray[2]);
                    const resultArr = colorConverter.getActualColor(convertedColor);
                    resultArr.push(channelArray[3]);
                    return resultArr;
                },
                matrix: Dither.matrices.floydSteinberg,
            };
            const dither = new Dither(options);
            const ditheredImg = dither.dither(this.data, this.width);
            const ditheredDataBuffer = Buffer.from(ditheredImg);
            this.data = ditheredDataBuffer;
            this.pack().pipe(fs.createWriteStream("expectedOutput.png"));
        } else {
            // Convert all colors to 24 provided by the website beforehand and output a picture for a preview.
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    // tslint:disable-next-line: no-bitwise
                    const idx = (this.width * y + x) << 2;

                    const r = this.data[idx + 0];
                    const g = this.data[idx + 1];
                    const b = this.data[idx + 2];
                    const convertedColor = colorConverter.convertActualColor(r, g, b);
                    const resultArr = colorConverter.getActualColor(convertedColor);
                    this.data[idx + 0] = resultArr[0];
                    this.data[idx + 1] = resultArr[1];
                    this.data[idx + 2] = resultArr[2];
                }
            }
            this.pack().pipe(fs.createWriteStream("expectedOutput.png"));
        }

        const worker = await PixelWorker.create(this, {x: params.xLeftMost, y: params.yTopMost}, params.doNotOverrideColors, params.fingerprint, params.customEdgesMapImagePath)

        await worker.heartBeat();
        // await for the full process. Here full image should be finished.

        // tslint:disable-next-line: no-console
        console.log("Finished painting!");

        if (!params.constantWatch) {
            // Job is done. Exit the process...
            // tslint:disable-next-line: no-console
            console.log("all done!");
            process.exit(0);
            return;
        }
        // Do not exit process, will continue to listen to socket changes and replace non matching pixels.
        // tslint:disable-next-line: no-console
        console.log("Continuing to watch over...");
    });
}

startAndGetUserInput();
