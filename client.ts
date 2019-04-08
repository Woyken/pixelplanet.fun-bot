import * as fs from "fs";
import { PNG } from "pngjs";
import readline from "readline";
import { ChunkCache } from "./chunkCache";
import colorConverter from "./colorConverter";
import { timeoutFor } from "./timeoutHelper";

const Dither = require("image-dither");

let chunks = new ChunkCache();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function startAndGetUserInput() {
    const args = process.argv.slice(2);

    let xLeftMost: number;
    if (args[0]) {
        xLeftMost = parseInt(args[0], 10);
        // tslint:disable-next-line: no-console
        console.log("x=" + xLeftMost);
    } else {
        xLeftMost = await readNumber("TopLeft x: ");
    }

    let yTopMost: number;
    if (args[1]) {
        yTopMost = parseInt(args[1], 10);
        // tslint:disable-next-line: no-console
        console.log("y=" + yTopMost);
    } else {
        yTopMost = await readNumber("TopLeft y: ");
    }

    let imgPath: string;
    if (args[2]) {
        imgPath = args[2];
        // tslint:disable-next-line: no-console
        console.log("imgPath=" + imgPath);
    } else {
        imgPath = await readString("Path to an image: ");
    }

    let ditherTheImageAnswer: string;
    if (args[3]) {
        ditherTheImageAnswer = args[3];
        // tslint:disable-next-line: no-console
        console.log("Dither the image=" + ditherTheImageAnswer);
    } else {
        ditherTheImageAnswer = await readString("Dither the image? [default=y] (y/n): ");
    }
    const ditherTheImage: boolean = ditherTheImageAnswer.toLowerCase() === "y" || !ditherTheImageAnswer;

    let fingerprint: string;
    if (args[4]) {
        fingerprint = args[4];
        // tslint:disable-next-line: no-console
        console.log("fingerprint=" + fingerprint);
    } else {
        fingerprint = await readString("Your fingerprint: ").then((a) => a || "aba2d6b6b48e0609bf63dae8a6f6d985");
    }

    let multipleMachines: boolean;
    if (args[5]) {
        multipleMachines = true;
    } else {
        multipleMachines = await readString("Running on multiple machines? [default=n] (y/n): ").then((a) => a.toLowerCase() === "y");
    }

    let machineCount: number = 1;
    if (args[5]) {
        machineCount = parseInt(args[5], 10);
        // tslint:disable-next-line: no-console
        console.log("machineCount=" + machineCount);
    } else if (multipleMachines) {
        machineCount = await readNumber("Machine count: ");
    }

    if (machineCount < 0) {
        throw new Error(`Invalid machine count, must be above 0`);
    }

    let machineId: number = 0;
    if (args[6]) {
        machineId = parseInt(args[6], 10);
        // tslint:disable-next-line: no-console
        console.log("machineId=" + machineId);
    } else if (multipleMachines) {
        machineId = await readNumber("Machine ID: ");
    }

    if (machineId < 0 || machineId >= machineCount) {
        throw new Error(`Invalid machine id, must be from 0 to ${machineCount - 1}`);
    }

    let constantWatchAnswer: string;
    if (args[7]) {
        constantWatchAnswer = args[7];
        // tslint:disable-next-line: no-console
        console.log("constantWatch=" + constantWatchAnswer);
    } else {
        constantWatchAnswer = await readString("Continue watching for changes (grief fix mode)? [default=n] (y/n): ");
    }
    const constantWatch: boolean = constantWatchAnswer.toLowerCase() === "y";

    return start(xLeftMost, yTopMost, imgPath, ditherTheImage, fingerprint, machineCount, machineId, constantWatch);
}
async function start(xLeftMost: number, yTopMost: number, imgPath: string, ditherTheImage: boolean, fingerprint: string, machineCount: number, machineId: number, constantWatch: boolean) {
    fs.createReadStream(imgPath)
    .pipe(new PNG())
    .on("parsed", async function(this: PNG) {

        if (ditherTheImage) {
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
                // For multiple machines:
                const cordId = x + y * this.width;
                if ((cordId + machineId + 1) % machineCount === 0) {
                    // This one is mine.
                } else {
                    // Not my job to paint this one
                    continue;
                }

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
        if (constantWatch) {
            // tslint:disable-next-line: no-console
            console.log("job done. Waiting for 5 minutes, will check again.");
            setTimeout(() => {
                chunks = new ChunkCache();
                start(xLeftMost, yTopMost, imgPath, ditherTheImage, fingerprint, machineCount, machineId, constantWatch);
            }, 300000);
        } else {
            // tslint:disable-next-line: no-console
            console.log("all done!");
        }
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

startAndGetUserInput().then(() => {
    rl.close();
}).catch(() => {
    rl.close();
});
