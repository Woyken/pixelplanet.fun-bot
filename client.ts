import * as fs from "fs";
import { PNG } from "pngjs";
import readline from "readline";
import { ChunkCache } from "./chunkCache";
import colorConverter from "./colorConverter";
import { timeoutFor } from "./timeoutHelper";

const Dither = require("image-dither");

const chunks = new ChunkCache();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function start() {
    const xLeftMost = await readNumber("TopLeft x:");
    const yTopMost = await readNumber("TopLeft y:");
    const imgPath = await readString("Path to an image:");
    const ditherAnswer = await readString("Dither the image? [default=y] (y/n):").then((a) => a === "y" || a === "Y" || !a);
    const fingerprint = await readString("Your fingerprint:").catch(() => "aba2d6b6b48e0609bf63dae8a6f6d985");

    fs.createReadStream(imgPath)
    .pipe(new PNG())
    .on("parsed", async function(this: PNG) {

        if (ditherAnswer) {
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
                    const convertedColor = colorConverter.convertActualColor(channelArray[0], channelArray[1], channelArray[2])
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

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // tslint:disable-next-line: no-bitwise
                const idx = (this.width * y + x) << 2;

                const r = this.data[idx + 0];
                const g = this.data[idx + 1];
                const b = this.data[idx + 2];
                const a = this.data[idx + 3];
                if (a === 0) {
                    // don't draw if alpha is 0
                    continue;
                }

                const targetPixel: {x: number, y: number} = { x: (xLeftMost + x), y: (yTopMost + y) };

                const targetColor = colorConverter.convertActualColor(r, g, b);
                const currentColor = await chunks.getCoordinateColor(targetPixel.x, targetPixel.y);
                if (!colorConverter.areColorsEqual(targetColor, currentColor)) {
                    const postPixelResult = await chunks.retryPostPixel(targetPixel.x, targetPixel.y, targetColor, fingerprint);
                    // tslint:disable-next-line: no-console
                    console.log("Just placed " + targetColor + " at " + targetPixel.x + ":" + targetPixel.y);
                    if (postPixelResult.waitSeconds > 50) {
                        await timeoutFor((postPixelResult.waitSeconds - 50) * 1000);
                    }
                }
            }
        }
        // tslint:disable-next-line: no-console
        console.log("all done!");
    });
}

async function readNumber(question: string): Promise<number> {
    const promise = new Promise<number>((resolve, reject) => {
        rl.question(question, (numStr: string) => {
            const num = parseInt(numStr, 10);
            if (isNaN(num)) {
                reject("invalid number");
                return;
            }
            resolve(num);
            return;
        });
    });
    return promise;
}

async function readString(question: string): Promise<string> {
    const promise = new Promise<string>((resolve, reject) => {
        rl.question(question, (str: string) => {
            resolve(str);
            return;
        });
    });
    return promise;
}

start().then(() => {
    rl.close();
}).catch(() => {
    rl.close();
});
