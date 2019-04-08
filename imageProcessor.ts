import * as fs from "fs";
// tslint:disable-next-line:no-var-requires
const sobel = require("sobel");

import { PNG } from "pngjs";

export class ImageProcessor {
    private imgData: PNG;
    private sobelData: Buffer;

    constructor(imgData: PNG) {
        const newPng = new PNG({height: imgData.height, width: imgData.width});
        newPng.data = Buffer.from(imgData.data);
        this.imgData = newPng;
        this.sobelData = sobel(this.imgData);

        const temp = this.imgData.data;
        this.imgData.data = this.sobelData;
        this.imgData.pack().pipe(fs.createWriteStream("currentlyMaking.png"));
    }

    public getIncrementalEdges(intensityValueMin: number, intensityValueMax: number): Array<{x: number, y: number}> {
        const resultCoordsArray: Array<{x: number, y: number}> = [];

        for (let y = 0; y < this.imgData.height; y++) {
            for (let x = 0; x < this.imgData.width; x++) {
                // tslint:disable-next-line: no-bitwise
                const idx = (this.imgData.width * y + x) << 2;

                const r = this.sobelData[idx + 0];
                const g = this.sobelData[idx + 1];
                const b = this.sobelData[idx + 2];
                const a = this.sobelData[idx + 3];

                if (g >= intensityValueMin && g <= intensityValueMax) {
                    resultCoordsArray.push({x, y});
                }
            }
        }
        return resultCoordsArray;
    }
}
