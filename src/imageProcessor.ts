import * as fs from 'fs';
// tslint:disable-next-line:no-var-requires
const sobel = require('sobel');

import { PNG } from 'pngjs';
import logger from './logger';

export class ImageProcessor {

    public static async create(imgData: PNG, customEdgesMapImgPath: string)
        : Promise<ImageProcessor> {
        return new Promise<ImageProcessor>((resolve, reject) => {
            if (customEdgesMapImgPath) {
                // edges map was provided, read it and save data.
                fs.createReadStream(customEdgesMapImgPath)
                .pipe(new PNG())
                .on('parsed', async function (this: PNG) {
                    resolve(new ImageProcessor(this));
                    return;
                }).on('error', (error) => {
// tslint:disable-next-line: max-line-length
                    logger.logError(`Could not load the customEdgesMap picture, make sure image is valid PNG file.\n${error.message}`);
                });
            } else {
                // create out own edges map.
                const newPng = new PNG({ height: imgData.height, width: imgData.width });
                newPng.data = Buffer.from(imgData.data);

                // generate edges data
                newPng.data = sobel(imgData);

                resolve(new ImageProcessor(newPng));
            }
        });

    }

    private imgData: PNG;

    private constructor(imgData: PNG) {
        this.imgData = imgData;
        imgData.pack().pipe(fs.createWriteStream('currentlyMaking.png')).on('close', () => {
            logger.log("currentlyMaking.png <- Contains the current edges map we're working with.");
        });
    }

    public getIncrementalEdges(intensityValueMin: number, intensityValueMax: number)
        : {x: number, y: number}[] {
        const resultCoordsArray: {x: number, y: number}[] = [];

        for (let y = 0; y < this.imgData.height; y++) {
            for (let x = 0; x < this.imgData.width; x++) {
                // tslint:disable-next-line: no-bitwise
                const idx = (this.imgData.width * y + x) << 2;

                const r = this.imgData.data[idx + 0];
                const g = this.imgData.data[idx + 1];
                const b = this.imgData.data[idx + 2];
                const a = this.imgData.data[idx + 3];

                if (g >= intensityValueMin && g <= intensityValueMax) {
                    resultCoordsArray.push({ x, y });
                }
            }
        }
        return resultCoordsArray;
    }
}
