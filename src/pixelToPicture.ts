import * as fs from 'fs';
import { PNG } from 'pngjs';
import { ChunkCache } from './chunkCache';
import colorConverter from './colorConverter';
import logger from './logger';

class PixelToPicture {
    private chunkCache = new ChunkCache();

    public async getPixelsToImageData(xLeft: number,
                                      yTop: number,
                                      xRight: number,
                                      yBottom: number,
        ): Promise<PNG> {
        const png = new PNG({ height: yBottom - yTop, width: xRight - xLeft });
        for (let y = 0; y < xRight - xLeft; y++) {
            for (let x = 0; x < png.width; x++) {

                const pixColor = await this.chunkCache.getCoordinateColor(xLeft + x, yTop + y);
                const [r, g, b] = colorConverter.getActualColor(pixColor);

                // tslint:disable-next-line:no-bitwise
                const idx = (png.width * y + x) << 2;

                png.data[idx + 0] = r;
                png.data[idx + 1] = g;
                png.data[idx + 2] = b;
                png.data[idx + 3] = 255;
            }
        }
        return png;
    }

    public async writeImageToFile(pngData: PNG, fileName: string) {
        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(fileName);
            fileStream.on('close', () => {
                resolve();
                return;
            });
            pngData.pack().pipe(fileStream);
        });
    }
}

const pixToPic = new PixelToPicture();
const x1 = parseInt(process.argv[2], 10);
const y1 = parseInt(process.argv[3], 10);
const x2 = parseInt(process.argv[4], 10);
const y2 = parseInt(process.argv[5], 10);
const filename = process.argv[6];

pixToPic.getPixelsToImageData(x1, y1, x2, y2).then(async (data) => {
    await pixToPic.writeImageToFile(data, filename);
    logger.log('all done!');
    process.exit(0);
    return;
}).catch();
